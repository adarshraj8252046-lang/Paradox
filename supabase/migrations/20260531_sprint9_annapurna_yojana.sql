-- ============================================================================
-- WelfareConnect Migration — Sprint 9 (Annapurna Yojana Scheme Update)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- This migration updates the previously added "Annapurna Bhandar" scheme 
-- to the new "Annapurna Yojana Scheme" based on the provided Family Level 
-- Data Collection Form PDF.

UPDATE public.schemes
SET 
  name = 'Annapurna Yojana Scheme',
  description = 'Comprehensive family-level social protection scheme by the Government of West Bengal requiring detailed family data collection including demographics, assets, occupation, education, and bank details for Direct Benefit Transfer (DBT).',
  category = 'Food Security & Social Welfare',
  benefit_amount = 'DBT Cash Transfers & Food Subsidies',
  required_documents = ARRAY[
    'Aadhaar Card (of Head of Family & all members)', 
    'Digital Ration Card (AAY, PHH, SPHH, RKSY1/2)', 
    'EPIC (Voter ID) with AC & Part No. (for all adults)', 
    'Bank Account Details (Account No. & IFSC for DBT)', 
    'Caste/EWS/Creamy Layer Certificate (if applicable)', 
    'PAN Card (if available)', 
    'Land/Vehicle Registration Records (if applicable)',
    'Pension Slip / Disability Certificate (if applicable)'
  ],
  ministry = 'Government of West Bengal',
  tags = ARRAY['food','ration','dbt','west bengal','annapurna','yojana']
WHERE name = 'Annapurna Bhandar';
