-- Trigger to automatically assign interactions when an agent accepts an application
CREATE OR REPLACE FUNCTION public.assign_interactions_to_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- If the assigned_agent_id changed from NULL to an agent
  IF OLD.assigned_agent_id IS NULL AND NEW.assigned_agent_id IS NOT NULL THEN
    -- Update all pending interactions for this application to belong to this agent
    UPDATE public.interactions
    SET agent_id = NEW.assigned_agent_id
    WHERE application_id = NEW.id AND agent_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assign_interactions ON public.applications;

CREATE TRIGGER trigger_assign_interactions
AFTER UPDATE OF assigned_agent_id ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.assign_interactions_to_agent();

-- Update any existing interactions that missed the trigger
UPDATE public.interactions i
SET agent_id = a.assigned_agent_id
FROM public.applications a
WHERE i.application_id = a.id
  AND a.assigned_agent_id IS NOT NULL
  AND i.agent_id IS NULL;
