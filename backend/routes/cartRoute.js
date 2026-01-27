import express from 'express';
import { addToCart, getUserCart, updateCart } from '../controllers/cartController.js';
import authUser from '../middleware/auth.js'; // Ensure you have this middleware!

const cartRouter = express.Router();

// Note: "authUser" middleware extracts the userId from the token
cartRouter.post('/get', authUser, getUserCart);
cartRouter.post('/add', authUser, addToCart);
cartRouter.post('/update', authUser, updateCart);

export default cartRouter;