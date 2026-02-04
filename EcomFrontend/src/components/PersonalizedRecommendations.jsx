import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import axios from 'axios';
import ProductItem from './ProductItem';
import Title from './Title';

const PersonalizedRecommendations = () => {
    const { backendUrl, cartItems, token } = useContext(ShopContext);
    const [recommended, setRecommended] = useState([]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            // 1. COLLECT PRODUCT IDs
            let productIds = [];
            let excludeIds = [];

            // A. Check Cart (Active Intent)
            for (const id in cartItems) {
                for (const size in cartItems[id]) {
                    if (cartItems[id][size] > 0) {
                        productIds.push(id);
                        excludeIds.push(id); // Don't recommend what is already in cart
                    }
                }
            }

            // B. If Cart is Empty, Check Order History
            if (productIds.length === 0 && token) {
                try {
                    const response = await axios.post(
                        backendUrl + '/api/order/userorders', 
                        {}, 
                        { headers: { token } }
                    );
                    
                    if (response.data.success && response.data.orders.length > 0) {
                        // Gather IDs from past orders
                        response.data.orders.forEach(order => {
                            order.items.forEach(item => {
                                productIds.push(item._id);
                                excludeIds.push(item._id); // Don't recommend what I already bought
                            });
                        });
                    }
                } catch (error) {
                    console.error("Error fetching order history:", error);
                }
            }

            // C. If we still have no data (New User), stop here.
            if (productIds.length === 0) {
                setRecommended([]);
                return;
            }

            // 2. SEND TO API (The Fix)
            try {
                // We send the list of IDs we like, AND the list of IDs to exclude
                const response = await axios.post(`${backendUrl}/api/product/recommend`, {
                    productIds: productIds.slice(0, 5), // Send top 5 items for context
                    excludeIds: excludeIds 
                });

                if (response.data.success) {
                    setRecommended(response.data.products);
                }
            } catch (error) {
                console.error("Error fetching recommendations:", error);
            }
        };

        fetchRecommendations();

    }, [cartItems, token, backendUrl]);

    if (recommended.length === 0) return null;

    return (
        <div className='my-10'>
            <div className='text-center py-8 text-3xl'>
                <Title text1={'RECOMMENDED'} text2={'FOR YOU'} />
                <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
                   Based on your cart and purchase history.
                </p>
            </div>

            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
                {recommended.map((item, index) => (
                    <ProductItem 
                        key={index} 
                        id={item._id} 
                        image={item.image} 
                        name={item.name} 
                        price={item.price} 
                    />
                ))}
            </div>
        </div>
    );
};

export default PersonalizedRecommendations;