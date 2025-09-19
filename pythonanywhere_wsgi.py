# This WSGI configuration is specifically for PythonAnywhere
import os
from gunicorn.app.wsgiapp import run

if __name__ == '__main__':
    # Default port if not set in environment
    os.environ.setdefault('PORT', '8000')
    run()
