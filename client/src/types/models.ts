export interface User {
    id:string;
    name:string;
    email:string;
    onboardingCompleted:boolean;
    onBoardingStep:number;
    coldStartComplete:boolean;
};