"""Data-access layer.

Intentionally empty in Part 01. Repositories must scope every query by the
caller's organisation (derived from a verified Supabase JWT), because the
service-role key used by the backend bypasses Row Level Security.
"""
