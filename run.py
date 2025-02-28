from controller import FlaskAppFactory
from os import environ

app = FlaskAppFactory.create_app()

if __name__ == "__main__":
    app.run(port=int(environ.get("PORT", 5000)), 
            debug=True            
        )