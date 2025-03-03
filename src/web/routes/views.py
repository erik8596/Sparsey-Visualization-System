from flask import Blueprint, render_template

views = Blueprint('views', __name__)

@views.route('/')
def index():
    """Serve the Three.js visualization page."""
    return render_template('index.html')