import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import axios from 'axios';
import ProductItem from './ProductItem';

const PersonalizedRecommendations = () => {
    const { backendUrl, cartItems, token, products } = useContext(ShopContext);
    const [recommended, setRecommended] = useState([]);
    const [seedProduct, setSeedProduct] = useState(null);

    // 1. Logic to find the "Seed" Product (Based on Cart or Orders)
    useEffect(() => {
        const findSeedProduct = async () => {
            // A. Check Cart First (Highest priority - Active Intent)
            let foundId = null;
            
            // Loop through cartItems object to find the first product with quantity > 0
            for (const id in cartItems) {
                for (const size in cartItems[id]) {
                    if (cartItems[id][size] > 0) {
                        foundId = id;
                        break;
                    }
                }
                if (foundId) break;
            }

            // B. If Cart is empty & User is logged in, Check Orders (History)
            if (!foundId && token) {
                try {
                    const response = await axios.post(
                        backendUrl + '/api/order/userorders', 
                        {}, 
                        { headers: { token } }
                    );
                    
                    if (response.data.success && response.data.orders.length > 0) {
                        // Get the first item of the most recent order
                        // Orders usually come sorted by date (newest first)
                        const lastOrder = response.data.orders[0]; 
                        if (lastOrder.items.length > 0) {
                            foundId = lastOrder.items[0]._id;
                        }
                    }
                } catch (error) {
                    console.error("Error fetching order history:", error);
                }
            }

            // C. Save the ID if we found one
            if (foundId) {
                const productDetails = products.find(p => p._id === foundId);
                setSeedProduct(productDetails); // Save details for the title (e.g., "Because you bought X")
                fetchRecommendations(foundId);
            }
        };

        findSeedProduct();
    }, [cartItems, token, products]);

    // 2. Fetch Recommendations from Python (via Node)
    const fetchRecommendations = async (id) => {
        try {
            const response = await axios.get(`${backendUrl}/api/product/recommend/${id}`);
            if (response.data.success) {
                setRecommended(response.data.products);
            }
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        }
    };

    // 3. Don't render anything if we have no recommendations (e.g. new user)
    if (recommended.length === 0) return null;

    return (
        <div className='my-10'>
            <div className='text-center text-3xl py-2'>
                <h2 className='mb-5'>
                    {seedProduct 
                        ? `Picked For You (Based on ${seedProduct.name})` 
                        : "Recommended For You"}
                </h2>
                <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
                    Based on your recent shopping activity.
                </p>
            </div>

            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
                {recommended.map((item, index) => (
                    <ProductItem 
                        key={index} 
                        id={item._id} 
                        name={item.name} 
                        image={item.image} 
                        price={item.price} 
                    />
                ))}
            </div>
        </div>
    );
};

export default PersonalizedRecommendations;