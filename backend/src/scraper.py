from flask import Flask

app = Flask(__name__)

@app.route("/<>")
def scrape():
    try:
        scrape
    except ModuleNotFoundError:
        return f'scraper not found'
    except Exception:
        return []