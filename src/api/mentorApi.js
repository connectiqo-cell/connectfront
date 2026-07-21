import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';
import {
  buildCategoryMatchOrFilter,
  isOtherCategoryLabel,
  mentorHasCategory,
  parseMentorCategories,
  normalizeCategoryBucket,
  OTHER_CATEGORY_LABEL,
} from '../utils/mentorCategories';

export const mentorApi = {
  getMentorWithProfile: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(`
          id,
          specialization,
          bio,
          experience_years,
          price_per_hour,
          rating,
          total_sessions,
          profiles:id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('id', mentorId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getTopMentors: async (limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(`
          id,
          specialization,
          bio,
          experience_years,
          price_per_hour,
          rating,
          total_sessions,
          profiles:id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getMentorsBySpecialization: async (specialization, limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(`
          id,
          specialization,
          bio,
          experience_years,
          price_per_hour,
          rating,
          total_sessions,
          profiles:id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .ilike('specialization', `%${specialization}%`)
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getMentorsByCategory: async (limitPerCategory = 6) => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(`
          id,
          category,
          specialization,
          bio,
          experience_years,
          price_per_hour,
          rating,
          total_sessions,
          profiles:id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .order('category', { ascending: true })
        .order('rating', { ascending: false })
        .limit(300);

      if (error) throw error;

      const grouped = {};
      const keyByLower = {};

      (data || []).forEach(mentor => {
        const categories = parseMentorCategories(mentor.category);
        const bucketNames = categories.length ? categories : [normalizeCategoryBucket('')];

        bucketNames.forEach(rawCategory => {
          const canonical = normalizeCategoryBucket(rawCategory);
          const lower = canonical.toLowerCase();
          const key = keyByLower[lower] || canonical;
          keyByLower[lower] = key;

          if (!grouped[key]) grouped[key] = [];
          if (grouped[key].some(m => m.id === mentor.id)) return;
          if (grouped[key].length < limitPerCategory) {
            grouped[key].push(mentor);
          }
        });
      });

      return grouped;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  searchMentors: async (query, page = 0, pageSize = 20) => {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const term = query.trim().toLowerCase();

      const selectFields = `
        id,
        category,
        specialization,
        bio,
        experience_years,
        price_per_hour,
        rating,
        total_sessions,
        profiles:id (
          id,
          name,
          email,
          avatar_url,
          username
        )
      `;

      // Run profile field search and name search in parallel
      const [fieldRes, nameRes] = await Promise.all([
        supabase
          .from('mentor_profiles')
          .select(selectFields)
          .or(`specialization.ilike.%${term}%,category.ilike.%${term}%,bio.ilike.%${term}%`)
          .order('rating', { ascending: false })
          .range(from, to),
        supabase
          .from('profiles')
          .select('id')
          .or(`name.ilike.%${term}%,username.ilike.%${term}%`),
      ]);

      if (fieldRes.error) throw fieldRes.error;

      let results = fieldRes.data || [];

      // Fetch mentor profiles for any name matches not already in results
      if (nameRes.data?.length > 0) {
        const existingIds = new Set(results.map(m => m.id));
        const newIds = nameRes.data.map(p => p.id).filter(id => !existingIds.has(id));

        if (newIds.length > 0) {
          const { data: byName } = await supabase
            .from('mentor_profiles')
            .select(selectFields)
            .in('id', newIds)
            .order('rating', { ascending: false });

          if (byName?.length) {
            results = [...results, ...byName];
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getMentorsByCategoryName: async (category, page = 0, pageSize = 12) => {
    try {
      const selectFields = `
        id,
        category,
        specialization,
        bio,
        experience_years,
        price_per_hour,
        rating,
        total_sessions,
        profiles:id (id, name, email, avatar_url)
      `;

      // Empty / Other / Others are grouped together on Discover. PostgREST
      // empty-string filters are unreliable, so load a wider window and filter.
      if (isOtherCategoryLabel(category)) {
        const fetchSize = Math.min(400, Math.max(80, (page + 2) * pageSize * 5));
        const { data, error } = await supabase
          .from('mentor_profiles')
          .select(selectFields)
          .order('rating', { ascending: false })
          .range(0, fetchSize - 1);

        if (error) throw error;

        const matched = (data || []).filter(mentor =>
          mentorHasCategory(mentor.category, OTHER_CATEGORY_LABEL),
        );
        const from = page * pageSize;
        return matched.slice(from, from + pageSize);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(selectFields)
        .or(buildCategoryMatchOrFilter(category))
        .order('rating', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data || []).filter(mentor => mentorHasCategory(mentor.category, category));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};