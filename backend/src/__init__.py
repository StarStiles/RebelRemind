from flask import Flask

app = Flask(__name__)

from src import scraper  # Ensure you import the routes
from src.scraper import app  # Expose Flask app for testing
