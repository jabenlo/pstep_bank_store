from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from src.models.user import db, Student, Item, Transaction, Purchase
from decimal import Decimal, ROUND_HALF_UP
import os
import uuid
from datetime import datetime
import csv
import io

teacher_bp = Blueprint('teacher', __name__)

def allowed_file(filename):
    """Check if file extension is allowed for image uploads"""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@teacher_bp.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    """Get teacher dashboard data"""
    students = Student.query.filter_by(teacher_id=current_user.id).all()
    items = Item.query.filter_by(teacher_id=current_user.id).all()
    
    # Calculate total revenue from all purchases by students of this teacher
    student_ids = [student.id for student in students]
    if student_ids:
        total_revenue = db.session.query(
            db.func.coalesce(db.func.sum(Purchase.total_amount), 0)
        ).filter(Purchase.student_id.in_(student_ids)).scalar()
        total_revenue = Decimal(str(total_revenue)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        total_revenue = Decimal('0.00')
    
    # Get recent transactions
    recent_transactions = db.session.query(Transaction).join(Student).filter(
        Student.teacher_id == current_user.id
    ).order_by(Transaction.created_at.desc()).limit(10).all()
    
    return jsonify({
        'students': [student.to_dict() for student in students],
        'items': [item.to_dict() for item in items],
        'total_revenue': float(total_revenue),
        'recent_transactions': [transaction.to_dict() for transaction in recent_transactions]
    }), 200

@teacher_bp.route('/students', methods=['POST'])
@login_required
def add_student():
    """Add a new student"""
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('student_id'):
        return jsonify({'error': 'Name and student ID are required'}), 400
    
    # Check if student ID already exists
    if Student.query.filter_by(student_id=data['student_id']).first():
        return jsonify({'error': 'Student ID already exists'}), 400
    
    balance = Decimal(str(data.get('balance', 0.00))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    student = Student(
        name=data['name'],
        student_id=data['student_id'],
        balance=float(balance),
        teacher_id=current_user.id
    )
    
    db.session.add(student)
    db.session.commit()
    
    return jsonify({
        'message': 'Student added successfully',
        'student': student.to_dict()
    }), 201

@teacher_bp.route('/students/<int:student_id>', methods=['DELETE'])
@login_required
def delete_student(student_id):
    """Delete a student"""
    student = Student.query.filter_by(id=student_id, teacher_id=current_user.id).first()
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({'message': 'Student deleted successfully'}), 200

@teacher_bp.route('/students/<int:student_id>/balance', methods=['POST'])
@login_required
def update_student_balance(student_id):
    data = request.get_json()
    
    if not data or 'type' not in data or 'amount' not in data:
        return jsonify({'error': 'Invalid data provided'}), 400
    
    student = Student.query.filter_by(id=student_id, teacher_id=current_user.id).first()
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    amount = Decimal(str(data['amount'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    transaction_type = data['type']
    description = data.get('description', f'Manual {transaction_type} by teacher')
    
    # Update student balance
    if transaction_type == 'credit':
        student.balance += amount
    elif transaction_type == 'debit':
        if student.balance < amount:
            return jsonify({'error': 'Insufficient balance'}), 400
        student.balance -= amount
    else:
        return jsonify({'error': 'Invalid transaction type'}), 400
    
    # Create transaction record
    transaction = Transaction(
        student_id=student.id,
        type=transaction_type,
        amount=float(amount),
        description=description
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify({
        'message': 'Balance updated successfully',
        'student': student.to_dict(),
        'transaction': transaction.to_dict()
    }), 200

@teacher_bp.route('/items', methods=['POST'])
@login_required
def add_item():
    """Add a new store item"""
    # Handle multipart form data for file upload
    name = request.form.get('name')
    description = request.form.get('description', '')
    price = request.form.get('price')
    
    if not name or not price:
        return jsonify({'error': 'Name and price are required'}), 400
    
    try:
        price = Decimal(str(price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    except Exception:
        return jsonify({'error': 'Invalid price format'}), 400
    
    image_path = None
    
    # Handle file upload
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename and allowed_file(file.filename):
            # Generate unique filename
            filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            image_path = f'/uploads/{filename}'
    
    item = Item(
        name=name,
        description=description,
        price=float(price),
        image_path=image_path,
        teacher_id=current_user.id
    )
    
    db.session.add(item)
    db.session.commit()
    
    return jsonify({
        'message': 'Item added successfully',
        'item': item.to_dict()
    }), 201

@teacher_bp.route('/items/<int:item_id>', methods=['PUT'])
@login_required
def update_item(item_id):
    """Update a store item"""
    item = Item.query.filter_by(id=item_id, teacher_id=current_user.id).first()
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    # Handle multipart form data
    name = request.form.get('name')
    description = request.form.get('description')
    price = request.form.get('price')
    
    if name:
        item.name = name
    if description is not None:
        item.description = description
    if price:
        try:
            item.price = float(Decimal(str(price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        except Exception:
            return jsonify({'error': 'Invalid price format'}), 400
    
    # Handle file upload
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename and allowed_file(file.filename):
            # Delete old image if exists
            if item.image_path:
                old_file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 
                                           item.image_path.split('/')[-1])
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
            
            # Save new image
            filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            item.image_path = f'/uploads/{filename}'
    
    db.session.commit()
    
    return jsonify({
        'message': 'Item updated successfully',
        'item': item.to_dict()
    }), 200

@teacher_bp.route('/items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_item(item_id):
    """Delete a store item"""
    item = Item.query.filter_by(id=item_id, teacher_id=current_user.id).first()
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    # Delete image file if exists
    if item.image_path:
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 
                               item.image_path.split('/')[-1])
        if os.path.exists(file_path):
            os.remove(file_path)
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'message': 'Item deleted successfully'}), 200

@teacher_bp.route('/students/<int:student_id>/statement', methods=['GET'])
@login_required
def generate_statement(student_id):
    """Generate and download student statement"""
    student = Student.query.filter_by(id=student_id, teacher_id=current_user.id).first()
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Get all transactions for the student
    transactions = Transaction.query.filter_by(student_id=student.id).order_by(
        Transaction.created_at.desc()
    ).all()
    
    # Get all purchases for the student
    purchases = db.session.query(Purchase, Item).join(Item).filter(
        Purchase.student_id == student.id
    ).order_by(Purchase.created_at.desc()).all()
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['PSTEP Classroom Bank Statement'])
    writer.writerow(['Student Name:', student.name])
    writer.writerow(['Student ID:', student.student_id])
    balance = Decimal(str(student.balance)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    writer.writerow(['Current Balance:', f'${balance:.2f}'])
    writer.writerow(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])  # Empty row
    
    # Write transactions header
    writer.writerow(['Date', 'Type', 'Amount', 'Description', 'Balance After'])
    
    # Combine and sort all transactions and purchases by date
    all_records = []
    
    for transaction in transactions:
        amount = Decimal(str(transaction.amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        all_records.append({
            'date': transaction.created_at,
            'type': transaction.type.title(),
            'amount': f'${amount:.2f}',
            'description': transaction.description,
            'balance_after': ''  # We'll calculate this if needed
        })
    for purchase, item in purchases:
        total_amount = Decimal(str(purchase.total_amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        all_records.append({
            'date': purchase.created_at,
            'type': 'Purchase',
            'amount': f'-${total_amount:.2f}',
            'description': f'Purchased {purchase.quantity}x {item.name}',
            'balance_after': ''
        })
    
    # Sort by date (newest first)
    all_records.sort(key=lambda x: x['date'], reverse=True)
    
    # Write records
    for record in all_records:
        writer.writerow([
            record['date'].strftime('%Y-%m-%d %H:%M:%S'),
            record['type'],
            record['amount'],
            record['description'],
            record['balance_after']
        ])
    
    # Create file-like object
    output.seek(0)
    file_data = io.BytesIO(output.getvalue().encode('utf-8'))
    
    return send_file(
        file_data,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'{student.name}_{student.student_id}_statement.csv'
    )

@teacher_bp.route('/students/<int:student_id>', methods=['PUT'])
@login_required
def update_student(student_id):
    """Update student information and/or balance"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    student = Student.query.filter_by(id=student_id, teacher_id=current_user.id).first()
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Update student name if provided
    if 'name' in data:
        student.name = data['name']
    
    # Update balance if amount and type are provided
    if 'amount' in data and 'type' in data:
        amount = Decimal(str(data['amount'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        transaction_type = data['type']
        description = data.get('description', f'Manual {transaction_type} by teacher')
        
        student_balance = Decimal(str(student.balance)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if transaction_type == 'credit':
            student_balance += amount
            student.balance = float(student_balance)
        elif transaction_type == 'debit':
            if student_balance < amount:
                return jsonify({'error': 'Insufficient balance'}), 400
            student_balance -= amount
            student.balance = float(student_balance)
        else:
            return jsonify({'error': 'Invalid transaction type'}), 400
        
        # Create transaction record
        transaction = Transaction(
            student_id=student.id,
            type=transaction_type,
            amount=float(amount),
            description=description
        )
        
        db.session.add(transaction)
    
    db.session.commit()
    
    response_data = {
        'message': 'Student updated successfully',
        'student': student.to_dict()
    }
    
    if 'amount' in data and 'type' in data:
        response_data['transaction'] = transaction.to_dict()
    
    return jsonify(response_data), 200

@teacher_bp.route('/items/<int:item_id>', methods=['GET'])
@login_required
def get_item(item_id):
    item = Item.query.filter_by(id=item_id, teacher_id=current_user.id).first()
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    return jsonify(item.to_dict()), 200