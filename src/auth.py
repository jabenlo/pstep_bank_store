from flask_login import LoginManager
from src.models.user import User, Student

login_manager = LoginManager()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def load_student(student_id):
    """Load student by student_id for student authentication"""
    return Student.query.filter_by(student_id=student_id).first()

def init_login_manager(app):
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'

