#!/bin/bash
# This file is used to start the FastAPI app with Gunicorn and Uvicorn workers

exec gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT
