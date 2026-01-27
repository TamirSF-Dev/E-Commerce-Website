import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import axios from 'axios';
import ProductItem from './ProductItem'; // We re-use your existing card design!

const RecommendedProducts = ({ productId }) => {
    
    const { backendUrl } = useContext(ShopContext);
    const [recommended, setRecommended] = useState([]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                // Call the new Node.js -> Python Gateway
                const response = await axios.get(`${backendUrl}/api/product/recommend/${productId}`);
                
                if (response.data.success) {
                    setRecommended(response.data.products);
                }
            } catch (error) {
                console.error("Error fetching recommendations:", error);
            }
        };

        if (productId) {
            fetchRecommendations();
        }

    }, [productId, backendUrl]);

    return (
        <div className='my-10'>
            <div className='text-center text-3xl py-2'>
                <h2 className='mb-5'>Recommended for You</h2>
            </div>

            {/* Grid Layout */}
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

export default RecommendedProducts;