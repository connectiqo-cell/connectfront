import { useState, useEffect } from 'react';
import { mentorApi } from '../api/mentorApi';

export const useMentors = () => {
  const [mentors, setMentors] = useState([]);
  const [filteredMentors, setFilteredMentors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load top mentors on mount
  useEffect(() => {
    const loadMentors = async () => {
      setLoading(true);
      try {
        const data = await mentorApi.getTopMentors(20);
        setMentors(data);
        setFilteredMentors(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMentors();
  }, []);

  // Filter mentors on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMentors(mentors);
      return;
    }

    const filtered = mentors.filter(
      mentor =>
        mentor.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mentor.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredMentors(filtered);
  }, [searchQuery, mentors]);

  const searchMentors = async (query, specialization) => {
    setLoading(true);
    try {
      const results = await mentorApi.searchMentors(query || specialization || '');
      setMentors(results);
      setFilteredMentors(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterBySpecialization = async (specialization) => {
    setLoading(true);
    try {
      const results = await mentorApi.getMentorsBySpecialization(specialization);
      setMentors(results);
      setFilteredMentors(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    mentors: filteredMentors,
    allMentors: mentors,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    searchMentors,
    filterBySpecialization,
  };
};
