from flask import Blueprint, request, jsonify, session
from src.models.user import db, Student, Item, Transaction, Purchase
from decimal import Decimal, ROUND_HALF_UP

student_bp = Blueprint('student', __name__)

def get_current_student():
    """Get current student from session"""
    student_id = session.get('student_id')
    if student_id:
        return Student.query.get(student_id)
    return None

def student_required(f):
    """Decorator to require student authentication"""
    def decorated_function(*args, **kwargs):
        student = get_current_student()
        if not student:
            return jsonify({'error': 'Student authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@student_bp.route('/dashboard', methods=['GET'])
@student_required
def dashboard():
    """Get student dashboard data"""
    student = get_current_student()
    
    # Get recent transactions
    recent_transactions = Transaction.query.filter_by(student_id=student.id).order_by(
        Transaction.created_at.desc()
    ).limit(5).all()
    
    # Get recent purchases
    recent_purchases = db.session.query(Purchase, Item).join(Item).filter(
        Purchase.student_id == student.id
    ).order_by(Purchase.created_at.desc()).limit(5).all()
    
    return jsonify({
        'student': student.to_dict(),
        'recent_transactions': [transaction.to_dict() for transaction in recent_transactions],
        'recent_purchases': [
            {
                'purchase': purchase.to_dict(),
                'item': item.to_dict()
            } for purchase, item in recent_purchases
        ]
    }), 200

@student_bp.route('/balance', methods=['GET'])
@student_required
def get_balance():
    """Get current student balance"""
    student = get_current_student()
    balance = Decimal(str(student.balance)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return jsonify({'balance': float(balance)}), 200

@student_bp.route('/store', methods=['GET'])
@student_required
def get_store_items():
    """Get all store items available for purchase"""
    student = get_current_student()
    
    # Get items from the same teacher
    items = Item.query.filter_by(teacher_id=student.teacher_id).all()
    
    return jsonify({
        'items': [item.to_dict() for item in items]
    }), 200

@student_bp.route('/cart', methods=['POST'])
@student_required
def add_to_cart():
    """Add item to shopping cart (stored in session)"""
    data = request.get_json()
    if not data or not data.get('item_id'):
        return jsonify({'error': 'Item ID is required'}), 400
    student = get_current_student()
    item_id = data['item_id']
    quantity = data.get('quantity', 1)
    item = Item.query.filter_by(id=item_id, teacher_id=student.teacher_id).first()
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    cart = session.get('cart', {})
    price = Decimal(str(item.price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if str(item_id) in cart:
        cart[str(item_id)]['quantity'] += quantity
    else:
        cart[str(item_id)] = {
            'item_id': int(item_id),
            'quantity': quantity,
            'price': float(price)
        }
    session['cart'] = cart
    return jsonify({
        'message': 'Item added to cart',
        'cart': cart
    }), 200

@student_bp.route('/cart', methods=['GET'])
@student_required
def get_cart():
    """Get current shopping cart"""
    cart = session.get('cart', {})
    cart_items = []
    total = Decimal('0.00')
    for item_id, cart_item in cart.items():
        item = Item.query.get(int(item_id))
        if item:
            price = Decimal(str(item.price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            item_total = Decimal(cart_item['quantity']) * price
            item_total = item_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            cart_items.append({
                'item': item.to_dict(),
                'quantity': cart_item['quantity'],
                'item_total': float(item_total)
            })
            total += item_total
    total = total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return jsonify({
        'cart_items': cart_items,
        'total': float(total)
    }), 200

@student_bp.route('/cart/<int:item_id>', methods=['PUT'])
@student_required
def update_cart_item(item_id):
    """Update quantity of item in cart"""
    data = request.get_json()
    
    if not data or 'quantity' not in data:
        return jsonify({'error': 'Quantity is required'}), 400
    
    cart = session.get('cart', {})
    quantity = data['quantity']
    
    if str(item_id) in cart:
        if quantity <= 0:
            # Remove item from cart
            del cart[str(item_id)]
        else:
            cart[str(item_id)]['quantity'] = quantity
        
        session['cart'] = cart
        return jsonify({'message': 'Cart updated', 'cart': cart}), 200
    else:
        return jsonify({'error': 'Item not in cart'}), 404

@student_bp.route('/cart/<int:item_id>', methods=['DELETE'])
@student_required
def remove_from_cart(item_id):
    """Remove item from cart"""
    cart = session.get('cart', {})
    
    if str(item_id) in cart:
        del cart[str(item_id)]
        session['cart'] = cart
        return jsonify({'message': 'Item removed from cart'}), 200
    else:
        return jsonify({'error': 'Item not in cart'}), 404

@student_bp.route('/purchase', methods=['POST'])
@student_required
def purchase_items():
    """Complete purchase of items in cart"""
    student = get_current_student()
    cart = session.get('cart', {})
    if not cart:
        return jsonify({'error': 'Cart is empty'}), 400
    total_amount = Decimal('0.00')
    purchase_items = []
    for item_id, cart_item in cart.items():
        item = Item.query.filter_by(id=int(item_id), teacher_id=student.teacher_id).first()
        if not item:
            return jsonify({'error': f'Item {item_id} not found'}), 404
        price = Decimal(str(item.price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        item_total = Decimal(cart_item['quantity']) * price
        item_total = item_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_amount += item_total
        purchase_items.append({
            'item': item,
            'quantity': cart_item['quantity'],
            'total': item_total
        })
    total_amount = total_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    student_balance = Decimal(str(student.balance)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if student_balance < total_amount:
        return jsonify({
            'error': 'Insufficient balance',
            'required': float(total_amount),
            'available': float(student_balance)
        }), 400
    try:
        student.balance = float(student_balance - total_amount)
        purchases = []
        for purchase_item in purchase_items:
            purchase = Purchase(
                student_id=student.id,
                item_id=purchase_item['item'].id,
                quantity=purchase_item['quantity'],
                total_amount=float(purchase_item['total'])
            )
            db.session.add(purchase)
            purchases.append(purchase)
        transaction = Transaction(
            student_id=student.id,
            type='debit',
            amount=float(total_amount),
            description=f'Purchase of {len(purchase_items)} items'
        )
        db.session.add(transaction)
        db.session.commit()
        session['cart'] = {}
        return jsonify({
            'message': 'Purchase completed successfully',
            'total_amount': float(total_amount),
            'new_balance': float(student.balance),
            'purchases': [purchase.to_dict() for purchase in purchases],
            'transaction': transaction.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Purchase failed. Please try again.'}), 500

@student_bp.route('/transactions', methods=['GET'])
@student_required
def get_transactions():
    """Get student transaction history"""
    student = get_current_student()
    
    transactions = Transaction.query.filter_by(student_id=student.id).order_by(
        Transaction.created_at.desc()
    ).all()
    
    return jsonify({
        'transactions': [transaction.to_dict() for transaction in transactions]
    }), 200

@student_bp.route('/purchases', methods=['GET'])
@student_required
def get_purchases():
    """Get student purchase history"""
    student = get_current_student()
    
    purchases = db.session.query(Purchase, Item).join(Item).filter(
        Purchase.student_id == student.id
    ).order_by(Purchase.created_at.desc()).all()
    
    return jsonify({
        'purchases': [
            {
                'purchase': purchase.to_dict(),
                'item': item.to_dict()
            } for purchase, item in purchases
        ]
    }), 200

