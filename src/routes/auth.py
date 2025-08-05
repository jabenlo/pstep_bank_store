from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from src.models.user import db, User, Student
from src.auth import load_student

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new teacher (first-time setup)"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Check if teacher already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    # Create new teacher
    teacher = User(username=data['username'], role='teacher')
    teacher.set_password(data['password'])
    
    db.session.add(teacher)
    db.session.commit()
    
    login_user(teacher)
    
    return jsonify({
        'message': 'Teacher registered successfully',
        'user': teacher.to_dict()
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login for teachers and students"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Invalid request data'}), 400
    
    # Teacher login (username/password)
    if data.get('username') and data.get('password'):
        user = User.query.filter_by(username=data['username']).first()
        
        if user and user.check_password(data['password']):
            login_user(user)
            return jsonify({
                'message': 'Login successful',
                'user': user.to_dict(),
                'user_type': 'teacher'
            }), 200
        else:
            return jsonify({'error': 'Invalid username or password'}), 401
    
    # Student login (student_id only)
    elif data.get('student_id'):
        student = load_student(data['student_id'])
        
        if student:
            # Store student info in session for student authentication
            session['student_id'] = student.id
            session['student_data'] = student.to_dict()
            return jsonify({
                'message': 'Login successful',
                'student': student.to_dict(),
                'user_type': 'student'
            }), 200
        else:
            return jsonify({'error': 'Invalid student ID'}), 401
    
    else:
        return jsonify({'error': 'Username/password or student ID required'}), 400

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout for both teachers and students"""
    logout_user()
    session.pop('student_id', None)
    session.pop('student_data', None)
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    """Get current teacher profile"""
    return jsonify({'user': current_user.to_dict()}), 200

@auth_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update teacher profile"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Invalid request data'}), 400
    
    # Update username if provided
    if data.get('username'):
        # Check if username is already taken by another user
        existing_user = User.query.filter_by(username=data['username']).first()
        if existing_user and existing_user.id != current_user.id:
            return jsonify({'error': 'Username already exists'}), 400
        current_user.username = data['username']
    
    # Update password if provided
    if data.get('password'):
        current_user.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': current_user.to_dict()
    }), 200

@auth_bp.route('/check-auth', methods=['GET'])
def check_auth():
    """Check authentication status"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict(),
            'user_type': 'teacher'
        }), 200
    elif session.get('student_id'):
        return jsonify({
            'authenticated': True,
            'student': session.get('student_data'),
            'user_type': 'student'
        }), 200
    else:
        return jsonify({'authenticated': False}), 200

