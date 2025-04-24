import unittest
import requests
from http import HTTPStatus
import time
from webscraping.academic_calendar import scrape
from tests import flask_app, db

# --- Test Class ---
class TestACScraperAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Run once before all tests in the class."""
        print("--- Starting Academic Calendar Scraper API Tests ---")
        # Configure and initialize the Flask app
        flask_app.config['TESTING'] = True
        flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

        cls.app = flask_app
        cls.app_context = cls.app.app_context()
        cls.app_context.push() # Push the app context

        db.drop_all()
        db.create_all()

        cls.client = cls.app.test_client() # Set up the test client
        
        # Check if the API server is running
        try:
            # Use a known endpoint like the list endpoint, or just the base
            response = cls.client.get("academiccalendar_list")
            # Allow 404 if list is just empty, but not server errors (5xx) or connection errors
            if response.status_code >= HTTPStatus.INTERNAL_SERVER_ERROR:
                 raise ConnectionError(f"API Server returned status {response.status_code}")
            print(f"API Server connection check status: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"\nFATAL: Cannot connect to API Server at {cls.client}. Ensure it's running.")
            print(f"Error details: {e}")
            # Stop tests if API isn't running
            raise ConnectionError(f"API Server at {cls.client} not reachable.") from e

    def setUp(self):
        """Run before each test method."""
        # Clean the specific table before each test to ensure independence
        print("\nClearing Academic Calendar events before test...")
        delete_response = self.client.delete("academiccalendar_delete_all") # Use correct endpoint
        # Check if deletion worked or if the table was already empty (200 OK)
        self.assertEqual(delete_response.status_code, HTTPStatus.OK,
                      f"Failed to clear previous Academic Calendar events: {delete_response.text}")
        print("Previous Academic Calendar events cleared (or table was empty).")
        time.sleep(0.5) # Give server a tiny bit of time

    def test_scrape_and_add_events(self):
        """
        Test scraping Academic Calendar and adding events via the API.
        Verifies events are retrievable afterwards.
        """
        print("Running Academic Calendar scraper and adding to database via API...")
        try:
            results = scrape()
            # PUT Academic Calendar events into the database
            for event in results:
                self.client.put("academiccalendar_add", json=event)
            print("Scraping and PUT requests completed.")
        except Exception as e:
            # If the scraper itself throws an error during the test
            self.fail(f"Scraping function 'academic_calendar.scrape()' failed with an exception: {e}")

        time.sleep(1) # Give server time to process database commits

        # Now check if events were added by retrieving the list
        print("Retrieving event list from API to verify additions...")
        response = self.client.get("academiccalendar_list") # Use correct endpoint

        self.assertEqual(response.status_code, HTTPStatus.OK,
                         f"Failed to get Academic Calendar list after scraping: {response.text}")

        retrieved_data = response.json()
        self.assertIsInstance(retrieved_data, list, "API did not return a list for Academic Calendar events.")
        self.assertGreater(len(retrieved_data), 0,
                           "Scraping ran, but no Academic Calendar events were found in the API list.")

        print(f"✅ Found {len(retrieved_data)} Academic Calendar events in API after scraping.")

        # Verify the structure of the first retrieved event
        first_event = retrieved_data[0]
        print(f"Verifying structure of first event: {first_event.get('name')}")
        self.assertIn("id", first_event)
        self.assertIn("name", first_event)
        self.assertIn("startDate", first_event) # API returns date as string
        self.assertIn("startTime", first_event) # Can be None
        self.assertIn("endDate", first_event) # API returns date as string
        self.assertIn("endTime", first_event) # Can be None
        
        event_id_to_get = first_event['id']
        print(f"Attempting to retrieve event ID {event_id_to_get} specifically...")
        indiv_response = self.client.get(f"academiccalendar_id/{event_id_to_get}") # Use correct endpoint
        self.assertEqual(indiv_response.status_code, HTTPStatus.OK,
                         f"Failed to get Academic Calendar event ID {event_id_to_get}: {indiv_response.text}")
        indiv_data = indiv_response.json()
        self.assertEqual(indiv_data['name'], first_event['name']) # Check name matches

        print(f"✅ Scraped Academic Calendar events successfully added and verified via API.")

    def test_get_events_after_adding(self):
        """
        Test retrieving the Academic Calendar event list after adding data.
        Ensures the list endpoint works correctly when data exists.
        """
        # Add data first by running the scraper
        print("Pre-populating Academic Calendar data for GET list test...")
        try:
            results = scrape()
            # PUT Academic Calendar events into the database
            for event in results:
                self.client.put("academiccalendar_add", json=event)
        except Exception as e:
             self.fail(f"Scraping function failed during setup for GET list test: {e}")
        time.sleep(0.5)

        print("Retrieving full Academic Calendar list...")
        response = self.client.get("academiccalendar_list") # Use correct endpoint

        self.assertEqual(response.status_code, HTTPStatus.OK, f"Failed to get Academic Calendar event list: {response.text}")

        retrieved_data = response.json()
        self.assertIsInstance(retrieved_data, list)
        self.assertGreater(len(retrieved_data), 0, "Academic Calendar list endpoint returned empty after data should have been added.")
        print(f"✅ Retrieved {len(retrieved_data)} Academic Calendar events successfully.")

        # Verify structure again for an item in the list
        event = retrieved_data[0]
        self.assertIn("name", event)
        self.assertIn("startDate", event)
        self.assertIn("startTime", event)
        self.assertIn("endDate", event)
        self.assertIn("endTime", event)
        print("✅ Event structure in list verified.")

    @classmethod
    def tearDownClass(cls):
        """Optional: Run once after all tests in the class."""
        print("\n--- Finished Academic Calendar Scraper API Tests ---")

if __name__ == '__main__':
    # Ensure the script using this test class is run directly
    unittest.main()
