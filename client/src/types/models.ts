export interface User {
    id:string;
    name:string;
    email:string;
    onBoardingCompleted:boolean;
    onBoardingStep:number;
    coldStartComplete:boolean;
};