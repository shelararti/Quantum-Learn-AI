from fastapi import APIRouter

from ..schemas import TutorRequest
from .. import tutor_content, adaptive, llm_tutor

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


@router.post("/ask")
def ask(req: TutorRequest):
    level = req.level or "beginner"
    user_id = req.user_id or "default"
    history = [h.model_dump() for h in req.history] if req.history else None
    topic = tutor_content.detect_topic(req.message)

    # Asking about a topic is itself a small signal of engagement with it.
    if topic:
        adaptive.record_engagement(user_id, topic)

    try:
        answer = llm_tutor.ask_llm(req.message, level=level, history=history)
        return {
            "topic": topic,
            "answer": answer,
            "source": "llm",
            "suggested_next": tutor_content.suggest_next_topics(topic) if topic else list(tutor_content.TOPICS.keys())[:2],
        }
    except llm_tutor.OllamaUnavailable as e:
        fallback = tutor_content.answer_question(req.message, level=level, explicit_topic=topic)
        fallback["source"] = "rule_based"
        fallback["llm_error"] = str(e)
        return fallback


@router.get("/llm-status")
def llm_status():
    return llm_tutor.check_health()


@router.get("/recommend")
def recommend(user_id: str = "default"):
    return adaptive.recommend_next(user_id)


@router.post("/record")
def record(user_id: str, topic: str, correct: bool):
    return {"mastery": adaptive.record_result(user_id, topic, correct)}
