from fastapi import FastAPI, HTTPException
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
db = client["Ecommerce"] # Connect explicitly to your DB

# Global variables to hold our model in memory
df = None
cosine_sim = None
indices = None

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
    # We fill NaN with empty strings just in case
    df['content'] = (
        df['name'] + " " + 
        df['description'].fillna('') + " " + 
        df['category'] + " " + 
        df['subCategory']
    )
    
    # Initialize TF-IDF Vectorizer
    # stop_words='english' removes common words like "the", "a", "is"
    tfidf = TfidfVectorizer(stop_words='english')
    
    # Convert text to Matrix
    tfidf_matrix = tfidf.fit_transform(df['content'])
    
    # Calculate Cosine Similarity Matrix
    cosine_sim = linear_kernel(tfidf_matrix, tfidf_matrix)
    
    # Create a mapping of Product ID to Index (for fast lookup)
    indices = pd.Series(df.index, index=df['_id']).drop_duplicates()
    
    print("✅ ML Model Trained Successfully!")

# 2. Train on Startup
@app.on_event("startup")
async def startup_event():
    train_model()

# 3. Recommendation Endpoint
@app.get("/recommend/{product_id}")
def recommend(product_id: str):
    """
    Returns a list of 5 similar product IDs based on content similarity.
    """
    global df, cosine_sim, indices
    
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Model not trained yet.")
        
    if product_id not in indices:
        raise HTTPException(status_code=404, detail="Product ID not found in ML model.")

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

# 4. Refresh Endpoint (Optional: to retrain without restarting server)
@app.get("/refresh")
def refresh_model():
    train_model()
    return {"status": "Model Retrained"}