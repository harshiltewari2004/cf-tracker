import axios,{AxiosError} from 'axios';

import { useAuthStore } from '@/stores/authStore';

const AUTH_PATHS =['/api/auth/login','/api/auth/register'];

const LOGIN_ROUTE = '/login';

export const apiClient = axios.create({
    baseURL:import.meta.env.VITE_API_URL,
    withCredentials:true,
});

apiClient.interceptors.response.use(
    (response)=>response,
    (error:AxiosError)=>{
        const requestPath = error.config?.url??'';
        const isAuthAttempt = AUTH_PATHS.some((p)=>requestPath.includes(p));

        if(error.response?.status===401&&!isAuthAttempt){
            useAuthStore.getState().clearAuth();

            if(window.location.pathname!=LOGIN_ROUTE){
                window.location.href=LOGIN_ROUTE;
            }
        }
        return Promise.reject(error);
    }
)