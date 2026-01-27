import { v2 as cloudinary } from "cloudinary"
import productModel from "../models/productModel.js"
import axios from "axios";

// Function for add product
const addProduct = async (req, res) => {
    try {
        const { name, description, price, category, subCategory, sizes, bestseller } = req.body;

        const image1 = req.files.image1 && req.files.image1[0]
        const image2 = req.files.image2 && req.files.image2[0]
        const image3 = req.files.image3 && req.files.image3[0]
        const image4 = req.files.image4 && req.files.image4[0]

        const images = [image1, image2, image3, image4].filter((item) => item !== undefined)

        let imagesUrl = await Promise.all(
            images.map(async (item) => {
                let result = await cloudinary.uploader.upload(item.path, { resource_type: 'image' });
                return result.secure_url
            })
        )

        const productData = {
            name,
            description,
            category,
            price: Number(price),
            subCategory,
            bestseller: bestseller === "true" ? true : false,
            sizes: JSON.parse(sizes),
            image: imagesUrl,
            date: Date.now()
        }

        console.log(productData);

        const product = new productModel(productData);
        await product.save()

        res.json({ success: true, message: "Product Added" })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Function for list product
const listProducts = async (req, res) => {
    try {
        const products = await productModel.find({});
        res.json({success:true, products})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Function for removing product
const removeProduct = async (req, res) => {
    try {
        await productModel.findByIdAndDelete(req.body.id)
        res.json({success:true, message:"Product Removed"})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Function for single product info
const singleProduct = async (req, res) => {
    try {
        const { productId } = req.body
        const product = await productModel.findById(productId)
        res.json({success:true, product})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Function to get recommendations from Python ML Service
const getRecommendations = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Call the Python Service
        // Note: Use 'http://127.0.0.1:8000' if running locally
        const pythonResponse = await axios.get(`http://127.0.0.1:8000/recommend/${id}`);
        const recommendedIds = pythonResponse.data;

        // 2. Fetch the actual product details from MongoDB using these IDs
        const products = await productModel.find({
            _id: { $in: recommendedIds }
        });

        // 3. (Optional) Sort them to match the order Python gave us
        // MongoDB doesn't guarantee order, so we re-sort them manually
        const sortedProducts = recommendedIds.map(id => 
            products.find(p => p._id.toString() === id)
        ).filter(p => p != null); // Filter out any nulls just in case

        res.json({ success: true, products: sortedProducts });

    } catch (error) {
        console.error("ML Service Error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

export { listProducts, addProduct, removeProduct, singleProduct, getRecommendations }