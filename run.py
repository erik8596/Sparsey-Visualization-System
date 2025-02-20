import os
from src.sparseypy.web.app import create_app

if __name__ == '__main__':
    app = create_app()
    app.run(
        port=int(os.environ.get('PORT', 5000)),
        debug=True
    )