-- ==============================================================================
-- MIGRATION: FIX TASK LIFECYCLE WORKFLOW (REJECTION & ADVANCEMENT)
-- Target: Ensures rejected tasks return to 'in_progress' in CURRENT phase.
-- Target: Ensures rejection reason is mandatory and persisted.
-- ==============================================================================

-- 1. RPC: request_task_validation
-- Called by employee when submitting proof.
-- FIX: Removed premature phase advancement.
CREATE OR REPLACE FUNCTION request_task_validation(
    p_task_id uuid,
    p_user_id uuid,
    p_proof_url text,
    p_proof_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task record;
    v_validations jsonb;
    v_current_phase text;
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Task not found');
    END IF;

    -- Stay in current phase
    v_current_phase := COALESCE(v_task.lifecycle_state, 'requirement_refiner');
    v_validations := COALESCE(v_task.phase_validations, '{}'::jsonb);

    -- Update the current phase validation entry
    v_validations := jsonb_set(v_validations, ARRAY[v_current_phase], 
        jsonb_build_object(
            'status', 'pending',
            'proof_url', p_proof_url,
            'proof_text', p_proof_text,
            'submitted_at', now(),
            'validated', false
        )
    );

    UPDATE tasks
    SET 
        phase_validations = v_validations,
        sub_state = 'pending_validation',
        updated_at = now()
    WHERE id = p_task_id;

    RETURN jsonb_build_object('success', true, 'message', 'Validation requested. Awaiting manager review.');
END;
$$;


-- 2. RPC: approve_task
-- Called by manager to approve a phase.
-- ADVANCES the task to the next phase.
CREATE OR REPLACE FUNCTION approve_task(
    p_task_id uuid,
    p_manager_id uuid,
    p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task record;
    v_validations jsonb;
    v_current_phase text;
    v_active_phases text[];
    v_current_index int;
    v_next_phase text;
    v_is_completed boolean := false;
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Task not found');
    END IF;

    v_current_phase := COALESCE(v_task.lifecycle_state, 'requirement_refiner');
    v_validations := COALESCE(v_task.phase_validations, '{}'::jsonb);
    
    -- Extract active phases
    IF v_validations ? 'active_phases' THEN
        SELECT array_agg(x)::text[] INTO v_active_phases FROM jsonb_array_elements_text(v_validations->'active_phases') x;
    ELSE
        v_active_phases := ARRAY['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'];
    END IF;

    -- Update current phase to approved
    v_validations := jsonb_set(v_validations, ARRAY[v_current_phase], 
        COALESCE(v_validations->v_current_phase, '{}'::jsonb) || jsonb_build_object(
            'status', 'approved',
            'validated', true,
            'approved_at', now(),
            'manager_comment', p_comment
        )
    );

    -- Find next phase
    v_current_index := array_position(v_active_phases, v_current_phase);
    IF v_current_index IS NOT NULL AND v_current_index < array_length(v_active_phases, 1) THEN
        v_next_phase := v_active_phases[v_current_index + 1];
    ELSE
        v_next_phase := v_current_phase;
        v_is_completed := true;
    END IF;

    UPDATE tasks
    SET 
        phase_validations = v_validations,
        lifecycle_state = v_next_phase,
        sub_state = CASE WHEN v_is_completed THEN 'approved' ELSE 'in_progress' END,
        status = CASE WHEN v_is_completed THEN 'completed' ELSE status END,
        updated_at = now()
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Phase approved successfully', 
        'new_lifecycle_state', v_next_phase,
        'is_completed', v_is_completed
    );
END;
$$;


-- 3. RPC: reject_task
-- Called by manager to reject a phase.
-- FIX: REVERTS to 'in_progress' but stays in current lifecycle phase.
CREATE OR REPLACE FUNCTION reject_task(
    p_task_id uuid,
    p_manager_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task record;
    v_validations jsonb;
    v_current_phase text;
BEGIN
    -- Validation: Ensure reason is provided
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rejection reason is mandatory');
    END IF;

    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Task not found');
    END IF;

    v_current_phase := COALESCE(v_task.lifecycle_state, 'requirement_refiner');
    v_validations := COALESCE(v_task.phase_validations, '{}'::jsonb);

    -- Update current phase to rejected
    v_validations := jsonb_set(v_validations, ARRAY[v_current_phase], 
        COALESCE(v_validations->v_current_phase, '{}'::jsonb) || jsonb_build_object(
            'status', 'rejected',
            'rejected_at', now(),
            'rejection_reason', p_reason,
            'validated', false
        )
    );

    -- IMPORTANT: We do NOT advance lifecycle_state. 
    -- We set sub_state to 'in_progress' so the employee sees it as active again.
    UPDATE tasks
    SET 
        phase_validations = v_validations,
        sub_state = 'in_progress',
        updated_at = now()
    WHERE id = p_task_id;

    RETURN jsonb_build_object('success', true, 'message', 'Task phase rejected. Feedback sent to employee.');
END;
$$;
