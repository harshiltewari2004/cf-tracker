import logger from '../config/logger.js';

const VERDICT_MAP = {
    OK:'OK',
    WRONG_ANSWER:'WA',
    TIME_LIMIT_EXCEEDED:'TLE',
    RUNTIME_ERROR:'RE',
    MEMORY_LIMIT_EXCEEDE:'MLE'
};

const FILTERED_VERDICTS = new Set(['COMPILATION ERROR','SKIPPED','TESTING']);

const KNOWN_PARTICIPANT_TYPE = new Set(['CONTESTANT','VIRTUAL','PRACTICE']);

export const parseSubmission =(raw)=>{
 if(FILTERED_VERDICTS.has(raw.verdict))return null;

 const verdict = VERDICT_MAP[raw.verdict];

 if(!verdict){
    logger.debug({cfSubmissionId:raw.id,verdict:raw.verdict},'unmapped verdict,skipping');
    return null;
}
    if(!KNOWN_PARTICIPANT_TYPE.has(raw.author.participantType)){
        logger.debug(
            {cfSubmissionId:raw.id,participantType:raw.author.participantType},
            'unknown participant type,skipping'
        );
        return null;
    }

return{
    cfSubmissionId:raw.id,

    cfContestId:raw.author.participantType==='PRACTICE'?null:(raw.contestId??null),
    problemContestId:raw.problem.contestId,
    cfIndex:raw.problem.index,verdict,
    participantType:raw.author.participantType,
    timeConsumed:raw.timeConsumedMillis,
    language:raw.programmingLanguage,

    submittedAt:new Date(raw.creationTimeSeconds*1000),
};
};