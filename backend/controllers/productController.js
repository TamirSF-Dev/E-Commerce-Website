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
        const { productIds, excludeIds } = req.body;
        const pythonResponse = await axios.post('http://127.0.0.1:8000/recommend', {
            product_ids: productIds,
            exclude_ids: excludeIds
        });
        const products = await productModel.find({ _id: { $in: pythonResponse.data } });
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

// 2. FOR PRODUCT PAGE (Single Item - ADD THIS BACK)
const getSingleRecommendation = async (req, res) => {
    try {
        const { id } = req.params;
        // Call Python GET endpoint
        const pythonResponse = await axios.get(`http://127.0.0.1:8000/recommend/${id}`);
        
        const products = await productModel.find({ _id: { $in: pythonResponse.data } });
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

// Update exports to include BOTH functions
export { listProducts, addProduct, removeProduct, singleProduct, getRecommendations, getSingleRecommendation }