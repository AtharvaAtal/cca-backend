import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/overview', async (req, res) => {
  const courses = await query('SELECT * FROM courses');
  const students = await query('SELECT * FROM students');
  const purchases = await query('SELECT * FROM purchases');
  const videos = await query('SELECT * FROM videos');

  const totalRevenue = purchases.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalStudents = students.length;
  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => c.status === 'published').length;
  const totalVideos = videos.length;
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);

  const revenueByMonth = {};
  purchases.forEach((p) => {
    const d = new Date(p.purchase_date);
    const key = `${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
    revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(p.amount);
  });

  const enrollmentByCourse = courses.map((c) => ({
    name: c.title,
    students: purchases.filter((p) => p.course_id === c.id).length,
    revenue: purchases
      .filter((p) => p.course_id === c.id)
      .reduce((s, p) => s + Number(p.amount), 0)
  }));

  const categoryMap = {};
  courses.forEach((c) => {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
  });
  const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  res.json({
    totalRevenue,
    totalStudents,
    totalCourses,
    publishedCourses,
    totalVideos,
    totalViews,
    revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
    enrollmentByCourse,
    categoryBreakdown,
    recentPurchases: purchases
      .slice()
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      .slice(0, 8)
      .map((p) => {
        const student = students.find((s) => s.id === p.student_id);
        const course = courses.find((c) => c.id === p.course_id);
        return {
          id: p.id,
          studentName: student?.name || 'Unknown',
          courseTitle: course?.title || 'Unknown',
          amount: Number(p.amount),
          date: p.purchase_date
        };
      })
  });
});

export default router;
