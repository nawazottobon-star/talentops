-- 1. Create tickets table if it doesn't exist (Dormant feature restoration)
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    org_id UUID REFERENCES public.organizations(id),
    type TEXT,
    category TEXT,
    priority TEXT,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    attachments TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create ticket_comments table
CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- 4. Policies for tickets
CREATE POLICY "SuperAdmins can do everything on tickets"
ON public.tickets FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'superadmin' OR profiles.role = 'super_admin')
    )
);

CREATE POLICY "Users can view their own tickets"
ON public.tickets FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. Policies for ticket_comments
CREATE POLICY "SuperAdmins can do everything on ticket_comments"
ON public.ticket_comments FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'superadmin' OR profiles.role = 'super_admin')
    )
);

CREATE POLICY "Users can view comments on their own tickets"
ON public.ticket_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tickets
        WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.user_id = auth.uid()
    )
);

CREATE POLICY "Users can add comments to their own tickets"
ON public.ticket_comments FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets
        WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.user_id = auth.uid()
    )
);
