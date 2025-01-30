import os
from app import init_app

if __name__ == '__main__':
    app = init_app()
    app.run(
        port=int(os.environ.get('PORT', 5000)),
        debug=True
    )