import os
import sys
from main import app

# Add your project directory to the path
path = '/home/acc950484/myaccountingapp/Business-Accounting-App-Deploy'
if path not in sys.path:
    sys.path.append(path)

# Import your FastAPI app

# This makes the app available as 'application' for WSGI
application = app
