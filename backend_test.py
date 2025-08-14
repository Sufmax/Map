import requests
import sys
import json
from datetime import datetime
import uuid

class GlobeInteractifAPITester:
    def __init__(self, base_url="https://interactive-globe-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_location_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("\n=== Testing Basic Endpoints ===")
        
        # Test root endpoint
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200
        )
        
        # Test health check
        success, response = self.run_test(
            "Health Check",
            "GET", 
            "api/health",
            200
        )
        
        return success

    def test_location_crud(self):
        """Test location CRUD operations"""
        print("\n=== Testing Location CRUD Operations ===")
        
        # Test create location
        test_location = {
            "name": "Test Location Paris",
            "latitude": 48.8566,
            "longitude": 2.3522,
            "description": "Test location in Paris for API testing",
            "category": "test",
            "user_id": "test_user_123"
        }
        
        success, response = self.run_test(
            "Create Location",
            "POST",
            "api/locations",
            200,
            data=test_location
        )
        
        if success and 'id' in response:
            self.created_location_id = response['id']
            print(f"   Created location ID: {self.created_location_id}")
        else:
            print("❌ Failed to create location - stopping CRUD tests")
            return False
            
        # Test get all locations
        success, response = self.run_test(
            "Get All Locations",
            "GET",
            "api/locations",
            200
        )
        
        # Test get specific location
        if self.created_location_id:
            success, response = self.run_test(
                "Get Specific Location",
                "GET",
                f"api/locations/{self.created_location_id}",
                200
            )
        
        # Test update location
        if self.created_location_id:
            update_data = {
                "name": "Updated Test Location Paris",
                "description": "Updated description for testing"
            }
            success, response = self.run_test(
                "Update Location",
                "PUT",
                f"api/locations/{self.created_location_id}",
                200,
                data=update_data
            )
        
        return success

    def test_location_search(self):
        """Test location search functionality"""
        print("\n=== Testing Location Search ===")
        
        search_data = {
            "query": "Paris",
            "limit": 5
        }
        
        success, response = self.run_test(
            "Search Locations",
            "POST",
            "api/locations/search",
            200,
            data=search_data
        )
        
        return success

    def test_stats_endpoint(self):
        """Test statistics endpoint"""
        print("\n=== Testing Stats Endpoint ===")
        
        success, response = self.run_test(
            "Get Map Statistics",
            "GET",
            "api/stats",
            200
        )
        
        return success

    def test_location_filtering(self):
        """Test location filtering with query parameters"""
        print("\n=== Testing Location Filtering ===")
        
        # Test filtering by category
        success, response = self.run_test(
            "Filter Locations by Category",
            "GET",
            "api/locations",
            200,
            params={"category": "test", "limit": 10}
        )
        
        # Test filtering by user_id
        success, response = self.run_test(
            "Filter Locations by User ID",
            "GET",
            "api/locations",
            200,
            params={"user_id": "test_user_123", "limit": 10}
        )
        
        return success

    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n=== Testing Error Handling ===")
        
        # Test get non-existent location
        fake_id = str(uuid.uuid4())
        success, response = self.run_test(
            "Get Non-existent Location",
            "GET",
            f"api/locations/{fake_id}",
            404
        )
        
        # Test update non-existent location
        success, response = self.run_test(
            "Update Non-existent Location",
            "PUT",
            f"api/locations/{fake_id}",
            404,
            data={"name": "Should not work"}
        )
        
        # Test delete non-existent location
        success, response = self.run_test(
            "Delete Non-existent Location",
            "DELETE",
            f"api/locations/{fake_id}",
            404
        )
        
        # Test create location with invalid data
        invalid_location = {
            "name": "Test",
            "latitude": "invalid",  # Should be float
            "longitude": 2.3522
        }
        
        success, response = self.run_test(
            "Create Location with Invalid Data",
            "POST",
            "api/locations",
            422,  # Validation error
            data=invalid_location
        )
        
        return True  # Error handling tests are expected to "fail" with proper error codes

    def cleanup(self):
        """Clean up test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        if self.created_location_id:
            success, response = self.run_test(
                "Delete Test Location",
                "DELETE",
                f"api/locations/{self.created_location_id}",
                200
            )
            if success:
                print(f"✅ Cleaned up test location: {self.created_location_id}")
            else:
                print(f"⚠️  Could not clean up test location: {self.created_location_id}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Globe Interactif API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        try:
            # Run all test suites
            self.test_basic_endpoints()
            self.test_location_crud()
            self.test_location_search()
            self.test_stats_endpoint()
            self.test_location_filtering()
            self.test_error_handling()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {str(e)}")
        
        finally:
            # Always try to cleanup
            self.cleanup()
            
            # Print final results
            print("\n" + "=" * 50)
            print(f"📊 Final Results: {self.tests_passed}/{self.tests_run} tests passed")
            
            if self.tests_passed == self.tests_run:
                print("🎉 All tests passed!")
                return 0
            else:
                print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
                return 1

def main():
    tester = GlobeInteractifAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())