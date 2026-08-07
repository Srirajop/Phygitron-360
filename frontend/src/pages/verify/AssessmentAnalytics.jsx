// Analytics merged into SubmissionsReview — redirect there.
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function AssessmentAnalytics() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => { nav(`/verify/submissions/${id}`, { replace: true }); }, [id]);
  return null;
}
