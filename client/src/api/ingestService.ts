import {apiClient} from './client';

import type { IngestStatusValue } from '@/types/models';

interface IngestStatusResponse{
    status:IngestStatusValue;
    submissionsIngested:number;
}

export const ingestService ={
    getStatus:async()=>{
        const res = await apiClient.get<{success:boolean;data:IngestStatusResponse}>(
            '/api/ingest/status',
        );
        return res.data.data;
    },
};
