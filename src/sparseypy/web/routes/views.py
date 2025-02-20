from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    session,
    flash
)
import requests
from src.sparseypy.wandb.wandb_facade import WandBFacade

views = Blueprint('views', __name__)

wandbf = WandBFacade()


@views.route('/')
def index():
    '''Home Page Route'''
    # Get list of runs from WandB
    try:
        response = requests.get(url_for('api.get_projects', _external=True))
        if response.ok:
            projects = response.json().get('projects', [])
        else:
            projects = []
            print(f"Error fetching projects: {response.status_code}")
    except Exception as e:
        projects = []
        flash(f"Error loading runs: {str(e)}", "error")
    
    return render_template('index.html', projects=projects)