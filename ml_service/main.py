from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

# 1. Setup & Config
load_dotenv()
app = FastAPI()

MONGO_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGO_URI)
db = client["Ecommerce"] # Ensure this matches your DB name exactly

# Global variables to hold our model in memory
df = None
cosine_sim = None
indices = None

# 2. Pydantic Model for POST Requests (Home Page)
class RecommendationRequest(BaseModel):
    product_ids: list[str]  # List of IDs user likes (Cart + Orders)
    exclude_ids: list[str]  # List of IDs to NOT recommend (Cart + Orders)

def train_model():
    """
    Fetches data from MongoDB and builds the similarity matrix.
    This runs once when the server starts.
    """
    global df, cosine_sim, indices
    
    # Fetch all products (we only need text fields)
    products = list(db.products.find({}, {"_id": 1, "name": 1, "description": 1, "category": 1, "subCategory": 1}))
    
    if not products:
        print("⚠️ No products found in DB. ML model cannot train.")
        return

    # Create DataFrame
    df = pd.DataFrame(products)
    
    # Ensure _id is a string (it comes as ObjectId from Mongo)
    df['_id'] = df['_id'].astype(str)
    
    # Combine relevant text features into one 'content' column
    df['content'] = (
        df['name'] + " " + 
        df['description'].fillna('') + " " + 
        df['category'] + " " + 
        df['subCategory']
    )
    
    # Initialize TF-IDF Vectorizer
    tfidf = TfidfVectorizer(stop_words='english')
    
    # Convert text to Matrix
    tfidf_matrix = tfidf.fit_transform(df['content'])
    
    # Calculate Cosine Similarity Matrix
    cosine_sim = linear_kernel(tfidf_matrix, tfidf_matrix)
    
    # Create a mapping of Product ID to Index (for fast lookup)
    indices = pd.Series(df.index, index=df['_id']).drop_duplicates()
    
    print("✅ ML Model Trained Successfully!")

# 3. Train on Startup
@app.on_event("startup")
async def startup_event():
    train_model()

# ==========================================
# ROUTE 1: Home Page (Personalized Logic)
# ==========================================
@app.post("/recommend")
def get_recommendations(request: RecommendationRequest):
    global df, cosine_sim, indices
    
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Model not trained.")

    # 1. Get indices of all input products (User history)
    valid_indices = [indices[pid] for pid in request.product_ids if pid in indices]
    
    # If user history has no matches in our DB, return empty list
    if not valid_indices:
        return []

    # 2. Sum up similarity scores for all input products
    # This finds items similar to the *collection* of things I like
    sim_scores = sum(cosine_sim[idx] for idx in valid_indices)

    # 3. Create a list of (Index, Score) tuples
    sim_scores = list(enumerate(sim_scores))

    # 4. Sort by score (highest first)
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)

    # 5. Filter Results
    final_recommendations = []
    for i, score in sim_scores:
        product_id = df['_id'].iloc[i]
        
        # EXCLUSION LOGIC: Don't recommend items I already own
        if product_id in request.exclude_ids:
            continue
            
        final_recommendations.append(product_id)
        
        if len(final_recommendations) >= 5: # Stop after 5 items
            break
            
    return final_recommendations

# ==========================================
# ROUTE 2: Product Page (Single Item Logic)
# ==========================================
@app.get("/recommend/{product_id}")
def recommend_single(product_id: str):
    """
    Returns a list of 5 similar product IDs based on content similarity.
    """
    global df, cosine_sim, indices
    
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Model not trained yet.")
        
    if product_id not in indices:
        raise HTTPException(status_code=404, detail="Product ID not found.")

    # Get the index of the product
    idx = indices[product_id]

    # Get similarity scores for this product
    sim_scores = list(enumerate(cosine_sim[idx]))

    # Sort products by score (highest first)
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)

    # Get top 5 similar products (skip index 0 because that's the product itself)
    top_indices = [i[0] for i in sim_scores[1:6]]

    # Return the Product IDs as a list
    return df['_id'].iloc[top_indices].tolist()

# 5. Refresh Endpoint
@app.get("/refresh")
def refresh_model():
    train_model()
    return {"status": "Model Retrained"}