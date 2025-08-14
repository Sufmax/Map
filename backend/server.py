from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(
    title="Globe Interactif API",
    description="API pour l'application de cartographie interactive",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models for Location data
class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    latitude: float
    longitude: float
    description: Optional[str] = None
    category: Optional[str] = "custom"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None

class LocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    description: Optional[str] = None
    category: Optional[str] = "custom"
    user_id: Optional[str] = None

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None

class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 10

# Legacy Status Check Models (keeping for backward compatibility)
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Basic routes
@api_router.get("/")
async def root():
    return {
        "message": "Globe Interactif API",
        "status": "active",
        "version": "1.0.0",
        "features": [
            "Interactive world map",
            "Location search",
            "Custom markers",
            "Multiple map layers"
        ]
    }

@api_router.get("/health")
async def health_check():
    try:
        # Check database connection
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

# Location Management Endpoints
@api_router.post("/locations", response_model=Location)
async def create_location(location_data: LocationCreate):
    """Create a new location marker"""
    try:
        location_dict = location_data.dict()
        location_obj = Location(**location_dict)
        
        # Insert into database
        result = await db.locations.insert_one(location_obj.dict())
        
        if result.inserted_id:
            return location_obj
        else:
            raise HTTPException(status_code=500, detail="Failed to create location")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating location: {str(e)}")

@api_router.get("/locations", response_model=List[Location])
async def get_locations(
    limit: int = 100,
    category: Optional[str] = None,
    user_id: Optional[str] = None
):
    """Retrieve locations with optional filtering"""
    try:
        query = {}
        if category:
            query["category"] = category
        if user_id:
            query["user_id"] = user_id
            
        locations = await db.locations.find(query).limit(limit).to_list(length=None)
        return [Location(**location) for location in locations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching locations: {str(e)}")

@api_router.get("/locations/{location_id}", response_model=Location)
async def get_location(location_id: str):
    """Get a specific location by ID"""
    try:
        location = await db.locations.find_one({"id": location_id})
        if location:
            return Location(**location)
        else:
            raise HTTPException(status_code=404, detail="Location not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching location: {str(e)}")

@api_router.put("/locations/{location_id}", response_model=Location)
async def update_location(location_id: str, update_data: LocationUpdate):
    """Update a location"""
    try:
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        result = await db.locations.update_one(
            {"id": location_id},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        updated_location = await db.locations.find_one({"id": location_id})
        return Location(**updated_location)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating location: {str(e)}")

@api_router.delete("/locations/{location_id}")
async def delete_location(location_id: str):
    """Delete a location"""
    try:
        result = await db.locations.delete_one({"id": location_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {"message": "Location deleted successfully", "id": location_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting location: {str(e)}")

# Search endpoint for locations
@api_router.post("/locations/search", response_model=List[Location])
async def search_locations(search_data: SearchQuery):
    """Search locations by name or description"""
    try:
        query = {
            "$or": [
                {"name": {"$regex": search_data.query, "$options": "i"}},
                {"description": {"$regex": search_data.query, "$options": "i"}}
            ]
        }
        
        locations = await db.locations.find(query).limit(search_data.limit).to_list(length=None)
        return [Location(**location) for location in locations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching locations: {str(e)}")

# Map statistics endpoint
@api_router.get("/stats")
async def get_map_stats():
    """Get statistics about the map data"""
    try:
        total_locations = await db.locations.count_documents({})
        
        # Count by category
        category_pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        category_stats = await db.locations.aggregate(category_pipeline).to_list(length=None)
        
        # Recent locations (last 24 hours)
        yesterday = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        recent_locations = await db.locations.count_documents({
            "created_at": {"$gte": yesterday}
        })
        
        return {
            "total_locations": total_locations,
            "categories": {item["_id"]: item["count"] for item in category_stats},
            "recent_locations": recent_locations,
            "last_updated": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

# Legacy status check endpoints (keeping for backward compatibility)
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    """Legacy endpoint for status checks"""
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    """Legacy endpoint for retrieving status checks"""
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Globe Interactif API starting up...")
    logger.info("Database connection established")

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.info("Shutting down Globe Interactif API...")
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)