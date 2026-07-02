import { create } from "zustand";

interface IngestState{
    isIngestActive:boolean;
    startIngest:()=>void;
    endIngest:()=>void;
}

export const useIngestStore = create<IngestState>((set)=>({
    isIngestActive:false,
    startIngest:()=>set({isIngestActive:true}),
    endIngest:()=>({isIngestActive:false}),
}));