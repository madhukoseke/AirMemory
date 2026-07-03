from __future__ import annotations

from airmemory.dashboard.components import incident_rows, result_summary
from airmemory.redis_client import RedisClient


def main() -> None:
    try:
        import streamlit as st
    except Exception as exc:
        raise SystemExit("Streamlit is not installed. Run `pip install -r requirements.txt`.") from exc

    st.set_page_config(page_title="AirMemory", layout="wide")
    st.title("AirMemory")
    st.caption("Airflow has logs. AirMemory gives it memory.")

    redis = RedisClient()
    latest = redis.latest_incident_ids()

    if not latest:
        st.info("No processed incidents yet.")
        st.code("python scripts/emit_demo_failure.py\npython scripts/run_worker.py --once", language="bash")
        return

    selected = st.sidebar.selectbox("Incident Inbox", latest)
    result = redis.fetch_result(selected)
    if not result:
        st.warning("Selected incident result is no longer available.")
        return

    incident = result.get("incident", {})
    advice = result.get("advice", {})

    st.subheader("Selected Incident")
    st.json(result_summary(result), expanded=False)

    left, right = st.columns([1, 1])
    with left:
        st.subheader("Similar Incidents")
        rows = incident_rows(result)
        if rows:
            st.dataframe(rows, hide_index=True, use_container_width=True)
        else:
            st.write("No similar incidents found.")

    with right:
        st.subheader("Recommended Fix")
        st.markdown(f"**Likely Root Cause**\n\n{advice.get('likely_root_cause', 'Unknown')}")
        st.markdown(f"**Recommended Fix**\n\n{advice.get('recommended_fix', 'Unknown')}")
        warning = advice.get("rejected_fix_warning") or "No rejected fix warning available."
        st.markdown(f"**Rejected Fix Warning**\n\n{warning}")
        st.markdown("**Next Steps**")
        for step in advice.get("recommended_next_steps", []):
            st.write(f"- {step}")

    st.subheader("Wiki Output")
    for path in result.get("wiki_paths", []):
        st.code(path)

    with st.expander("Cognee Evidence"):
        st.text(result.get("cognee_recall_text") or "No recall evidence returned.")

    with st.expander("Raw Incident JSON"):
        st.json(incident)


if __name__ == "__main__":
    main()
