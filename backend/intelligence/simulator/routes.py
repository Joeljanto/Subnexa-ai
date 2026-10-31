"""
What-If Revenue Recovery Simulator API routes.
"""
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.auth.decorators import jwt_required, role_required
from backend.intelligence.simulator.engine import (
    run_recovery_simulation,
    get_benchmark_specifications,
)
from backend.intelligence.simulator.models import SavedScenario

simulator_bp = Blueprint("simulator", __name__)


@simulator_bp.post("/simulate")
@jwt_required
@role_required("admin", "staff")
def simulate():
    """
    Execute a What-If recovery simulation across customer/subscription cohorts.
    Guaranteed strictly read-only on core billing entities.
    """
    data = request.get_json(silent=True) or {}
    db = get_session()
    try:
        results = run_recovery_simulation(db, data)
        return jsonify(results)
    finally:
        db.close()


@simulator_bp.get("/benchmarks")
@jwt_required
@role_required("admin", "staff")
def get_benchmarks():
    """
    Returns empirical/historically validated recovery benchmark rates.
    """
    return jsonify({"benchmarks": get_benchmark_specifications()})


@simulator_bp.get("/scenarios")
@jwt_required
@role_required("admin", "staff")
def list_scenarios():
    """
    List all saved simulation scenarios.
    """
    db = get_session()
    try:
        scenarios = (
            db.query(SavedScenario)
            .order_by(SavedScenario.created_at.desc())
            .all()
        )
        return jsonify({"scenarios": [s.to_dict() for s in scenarios]})
    finally:
        db.close()


@simulator_bp.post("/scenarios")
@jwt_required
@role_required("admin")
def save_scenario():
    """
    Save a simulation scenario with its parameters and projection results.
    """
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    parameters = data.get("parameters") or {}
    results = data.get("results") or {}

    if not name:
        return jsonify({"error": "Scenario name is required"}), 400

    db = get_session()
    try:
        scenario = SavedScenario(
            name=name,
            description=description,
            created_by=getattr(g.current_user, "id", None),
        )
        scenario.set_parameters(parameters)
        scenario.set_results(results)

        db.add(scenario)
        db.commit()
        db.refresh(scenario)

        return jsonify({
            "message": "Scenario saved successfully",
            "scenario": scenario.to_dict(),
        }), 201
    finally:
        db.close()


@simulator_bp.get("/scenarios/<string:scenario_id>")
@jwt_required
@role_required("admin", "staff")
def get_scenario(scenario_id: str):
    """
    Get a specific saved scenario.
    """
    db = get_session()
    try:
        scenario = db.get(SavedScenario, scenario_id)
        if not scenario:
            return jsonify({"error": "Scenario not found"}), 404
        return jsonify(scenario.to_dict())
    finally:
        db.close()


@simulator_bp.delete("/scenarios/<string:scenario_id>")
@jwt_required
@role_required("admin")
def delete_scenario(scenario_id: str):
    """
    Delete a saved scenario.
    """
    db = get_session()
    try:
        scenario = db.get(SavedScenario, scenario_id)
        if not scenario:
            return jsonify({"error": "Scenario not found"}), 404
        db.delete(scenario)
        db.commit()
        return jsonify({"message": f"Scenario '{scenario.name}' deleted successfully"})
    finally:
        db.close()
