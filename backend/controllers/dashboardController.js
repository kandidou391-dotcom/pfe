const User = require("../models/userSchema");
const Cours = require("../models/coursSchema");
const Presence = require("../models/presenceSchema");
const Note = require("../models/noteSchema");
const Classe = require("../models/classeSchema");
const Announcement = require("../models/announcementSchema");
const Examen = require("../models/examenSchema");
const Notification = require("../models/notificationSchema");
const Seance = require("../models/seanceSchema");
const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

/* ===========================================================
  GET DASHBOARD STATS
=========================================================== */
exports.getDashboardStats = async (req, res) => {
  try {
    const user = req.user; // Assuming auth middleware sets req.user
    const requestedRole = req.query.role; // Allow overriding role for testing
    const userRole = requestedRole || user?.role;

    // If no user and no role specified, default to student for testing
    const defaultRole = 'student';
    const finalRole = userRole || defaultRole;

    const isTeacher = finalRole === 'enseignant' || finalRole === 'teacher';
    const isStudent = finalRole === 'etudiant' || finalRole === 'student';

    // Check cache first - different cache for teacher and student
    let cacheKey;
    if (isTeacher) {
      cacheKey = `teacher_dashboard_stats_${user?._id || 'unknown'}_v3`;
    } else if (isStudent) {
      cacheKey = `student_dashboard_stats_${user?._id || 'unknown'}_v3`;
    } else {
      cacheKey = 'dashboard_stats_v3';
    }
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    let stats, enrollmentData, genderData, classPerformanceData, classAttendanceData, announcements, recentActivity, todaysSessions;

    if (isTeacher) {
      // Teacher-specific stats
      const isRoleOverridden = requestedRole && requestedRole !== user?.role;
      const teacherId = isRoleOverridden ? null : user?._id; // Use null for mock data when role is overridden

      // Use mock data when role is overridden (no real teacher data)
      const coursesTaught = isRoleOverridden ? 3 : await Cours.countDocuments({ enseignant: teacherId });
      const assignmentsCreated = isRoleOverridden ? 5 : await Examen.countDocuments({ enseignantId: teacherId, type: { $regex: /assignment/i } });
      const totalStudentsInClasses = isRoleOverridden ? 25 : await Classe.find({ enseignants: teacherId }).populate('etudiants').then(classes => classes.reduce((sum, cls) => sum + (cls.etudiants?.length || 0), 0));
      const teacherAttendanceRate = isRoleOverridden ? 85 : await Seance.find({ enseignant: teacherId }).distinct('_id').then(sessionIds => Presence.find({ seance: { $in: sessionIds } })).then(presences => {
        const total = presences.length;
        const present = presences.filter(p => p.statut === 'présent').length;
        return total > 0 ? Math.round((present / total) * 100) : 0;
      });

      // Recent announcements (same as admin)
      announcements = await Announcement.find({ estActif: true })
        .populate("auteur", "prenom nom")
        .sort({ createdAt: -1 })
        .limit(4)
        .then(announcements => announcements.map(ann => ({
          title: ann.titre,
          description: ann.contenu.length > 100 ? ann.contenu.substring(0, 100) + "..." : ann.contenu,
          date: getTimeAgo(ann.createdAt),
          type: ann.type,
          icon: getAnnouncementIcon(ann.type),
        })));

      // Recent activity: recent notifications for the teacher
      recentActivity = isRoleOverridden ? [
        {
          action: "Assignment submitted by John Doe for Mathematics 101",
          user: "Dr. Smith",
          time: "2 hours ago",
          icon: "📩",
          color: "from-green-500 to-emerald-400",
        },
        {
          action: "New assignment created: Algebra Homework",
          user: "Dr. Smith",
          time: "1 day ago",
          icon: "📝",
          color: "from-blue-500 to-cyan-400",
        },
        {
          action: "Grade submitted for Physics Lab Report",
          user: "Dr. Smith",
          time: "2 days ago",
          icon: "📊",
          color: "from-purple-500 to-pink-400",
        },
      ] : await Notification.find({ utilisateur: teacherId })
        .sort({ createdAt: -1 })
        .limit(10)
        .then(notifications => {
          if (notifications.length === 0) {
            // Mock data if no notifications exist
            return [
              {
                action: "Assignment submitted by John Doe for Mathematics 101",
                user: `${user?.prenom || 'Teacher'} ${user?.nom || ''}`.trim(),
                time: "2 hours ago",
                icon: "📩",
                color: "from-green-500 to-emerald-400",
              },
              {
                action: "New assignment created: Algebra Homework",
                user: `${user?.prenom || 'Teacher'} ${user?.nom || ''}`.trim(),
                time: "1 day ago",
                icon: "📝",
                color: "from-blue-500 to-cyan-400",
              },
              {
                action: "Grade submitted for Physics Lab Report",
                user: `${user?.prenom || 'Teacher'} ${user?.nom || ''}`.trim(),
                time: "2 days ago",
                icon: "📊",
                color: "from-purple-500 to-pink-400",
              },
            ];
          }
          return notifications.map(notif => ({
            action: notif.message,
            user: `${user?.prenom || 'Teacher'} ${user?.nom || ''}`.trim(),
            time: getTimeAgo(notif.createdAt),
            icon: getNotificationIcon(notif.type),
            color: getNotificationColor(notif.type),
          }));
        });

      // Stats for teacher
      stats = [
        {
          title: "Courses Taught",
          value: coursesTaught.toString(),
          icon: "📚",
          change: "+2", // Mock
          color: "from-blue-500 to-cyan-400",
        },
        {
          title: "Assignments Created",
          value: assignmentsCreated.toString(),
          icon: "📝",
          change: "+1", // Mock
          color: "from-purple-500 to-pink-400",
        },
        {
          title: "Students in Classes",
          value: totalStudentsInClasses.toString(),
          icon: "👥",
          change: "+5", // Mock
          color: "from-green-500 to-emerald-400",
        },
        {
          title: "Attendance Rate",
          value: `${teacherAttendanceRate}%`,
          icon: "📈",
          change: "+3%", // Mock
          color: "from-cyan-400 to-purple-500",
        },
      ];

      // Today's sessions for teacher
      todaysSessions = isRoleOverridden ? [
        {
          id: 'mock-session-1',
          course: 'Mathematics 101',
          class: 'Class A',
          time: '08:00 - 09:30',
          room: 'Room 101',
          type: 'Lecture',
        },
        {
          id: 'mock-session-2',
          course: 'Physics 201',
          class: 'Class B',
          time: '10:00 - 11:30',
          room: 'Room 203',
          type: 'Lab',
        },
      ] : await Seance.find({ enseignant: teacherId, statut: 'actif' })
        .populate({
          path: 'emploiDuTemps',
          match: { dateDebut: { $lte: new Date() }, dateFin: { $gte: new Date() } }
        })
        .populate('cours', 'nom')
        .populate('classe', 'nom')
        .sort({ heureDebut: 1 })
        .then(sessions => sessions.filter(s => s.emploiDuTemps && s.jourSemaine === ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()]))
        .then(sessions => sessions.map(session => ({
          id: session._id,
          course: session.cours?.nom || 'Unknown Course',
          class: session.classe?.nom || 'Unknown Class',
          time: `${session.heureDebut} - ${session.heureFin}`,
          room: session.salle,
          type: session.typeCours,
        })));

      // Other data can be empty or minimal for teacher
      enrollmentData = [];
      genderData = { male: 0, female: 0, maleCount: 0, femaleCount: 0 };
      classPerformanceData = [];
      classAttendanceData = [];

    } else if (isStudent) {
      // Student-specific stats
      const isRoleOverridden = requestedRole && requestedRole !== user?.role;
      const studentId = isRoleOverridden ? null : user?._id; // Use null for mock data when role is overridden

      // Get student's enrolled courses
      const enrolledCourses = isRoleOverridden ? 4 : await Classe.find({ etudiants: studentId }).populate('cours').then(classes => classes.map(cls => cls.cours).filter(Boolean));

      // Get student's assignments/exams
      const assignmentsCompleted = isRoleOverridden ? 8 : await Note.find({ etudiant: studentId }).countDocuments();

      // Get upcoming exams/assignments for the student
      const upcomingExamsAssignments = isRoleOverridden ? 3 : await Examen.find({
        classeId: { $in: await Classe.find({ etudiants: studentId }).distinct('_id') },
        date: { $gte: new Date() }
      }).countDocuments();

      // Get student's attendance rate
      const studentAttendanceRate = isRoleOverridden ? 92 : await Presence.find({ etudiant: studentId }).then(presences => {
        const total = presences.length;
        const present = presences.filter(p => p.statut === 'présent').length;
        return total > 0 ? Math.round((present / total) * 100) : 0;
      });

      // Get student's average grade (GPA)
      const averageGrade = isRoleOverridden ? 85 : await Note.find({ etudiant: studentId }).then(notes => {
        const total = notes.length;
        const sum = notes.reduce((acc, note) => acc + (note.note || 0), 0);
        return total > 0 ? Math.round(sum / total) : 0;
      });

      // Recent announcements (same as others)
      announcements = await Announcement.find({ estActif: true })
        .populate("auteur", "prenom nom")
        .sort({ createdAt: -1 })
        .limit(4)
        .then(announcements => announcements.map(ann => ({
          title: ann.titre,
          description: ann.contenu.length > 100 ? ann.contenu.substring(0, 100) + "..." : ann.contenu,
          date: getTimeAgo(ann.createdAt),
          type: ann.type,
          icon: getAnnouncementIcon(ann.type),
        })));

      // Recent activity: recent notifications for the student
      recentActivity = isRoleOverridden ? [
        {
          action: "Assignment submitted for Mathematics 101",
          user: "You",
          time: "2 hours ago",
          icon: "📩",
          color: "from-green-500 to-emerald-400",
        },
        {
          action: "Grade received: 85/100 in Physics Lab",
          user: "You",
          time: "1 day ago",
          icon: "📊",
          color: "from-blue-500 to-cyan-400",
        },
        {
          action: "New assignment posted: Chemistry Homework",
          user: "Dr. Johnson",
          time: "2 days ago",
          icon: "📝",
          color: "from-purple-500 to-pink-400",
        },
      ] : await Notification.find({ utilisateur: studentId })
        .sort({ createdAt: -1 })
        .limit(10)
        .then(notifications => {
          if (notifications.length === 0) {
            // Mock data if no notifications exist
            return [
              {
                action: "Assignment submitted for Mathematics 101",
                user: `${user?.prenom || 'Student'} ${user?.nom || ''}`.trim(),
                time: "2 hours ago",
                icon: "📩",
                color: "from-green-500 to-emerald-400",
              },
              {
                action: "Grade received: 85/100 in Physics Lab",
                user: `${user?.prenom || 'Student'} ${user?.nom || ''}`.trim(),
                time: "1 day ago",
                icon: "📊",
                color: "from-blue-500 to-cyan-400",
              },
              {
                action: "New assignment posted: Chemistry Homework",
                user: "Dr. Johnson",
                time: "2 days ago",
                icon: "📝",
                color: "from-purple-500 to-pink-400",
              },
            ];
          }
          return notifications.map(notif => ({
            action: notif.message,
            user: `${user?.prenom || 'Student'} ${user?.nom || ''}`.trim(),
            time: getTimeAgo(notif.createdAt),
            icon: getNotificationIcon(notif.type),
            color: getNotificationColor(notif.type),
          }));
        });

      // Stats for student
      stats = [
        {
          title: "Enrolled Courses",
          value: enrolledCourses.length.toString(),
          icon: "📚",
          change: "+1", // Mock
          color: "from-blue-500 to-cyan-400",
        },
        {
          title: "Upcoming Exams/Assignments",
          value: upcomingExamsAssignments.toString(),
          icon: "📝",
          change: "+2", // Mock
          color: "from-purple-500 to-pink-400",
        },
        {
          title: "Attendance Rate",
          value: `${studentAttendanceRate}%`,
          icon: "📈",
          change: "+5%", // Mock
          color: "from-green-500 to-emerald-400",
        },
        {
          title: "Average Grade",
          value: `${averageGrade}/100`,
          icon: "🎓",
          change: "+3", // Mock
          color: "from-cyan-400 to-purple-500",
        },
      ];

      // Today's sessions for student
      todaysSessions = isRoleOverridden ? [
        {
          id: 'mock-session-1',
          course: 'Mathematics 101',
          class: 'Class A',
          time: '08:00 - 09:30',
          room: 'Room 101',
          type: 'Lecture',
        },
        {
          id: 'mock-session-2',
          course: 'Physics 201',
          class: 'Class B',
          time: '10:00 - 11:30',
          room: 'Room 203',
          type: 'Lab',
        },
      ] : await Seance.find({ classe: { $in: await Classe.find({ etudiants: studentId }).distinct('_id') }, statut: 'actif' })
        .populate({
          path: 'emploiDuTemps',
          match: { dateDebut: { $lte: new Date() }, dateFin: { $gte: new Date() } }
        })
        .populate('cours', 'nom')
        .populate('classe', 'nom')
        .sort({ heureDebut: 1 })
        .then(sessions => sessions.filter(s => s.emploiDuTemps && s.jourSemaine === ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()]))
        .then(sessions => sessions.map(session => ({
          id: session._id,
          course: session.cours?.nom || 'Unknown Course',
          class: session.classe?.nom || 'Unknown Class',
          time: `${session.heureDebut} - ${session.heureFin}`,
          room: session.salle,
          type: session.typeCours,
        })));

      // Other data can be empty or minimal for student
      enrollmentData = [];
      genderData = { male: 0, female: 0, maleCount: 0, femaleCount: 0 };
      classPerformanceData = [];
      classAttendanceData = [];

    } else {
      // Admin stats (existing logic)
      // Use aggregation pipeline for efficient counting and stats
      const userStats = await User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
            maleCount: {
              $sum: { $cond: [{ $and: [{ $eq: ["$role", "etudiant"] }, { $eq: ["$sexe", "Homme"] }] }, 1, 0] }
            },
            femaleCount: {
              $sum: { $cond: [{ $and: [{ $eq: ["$role", "etudiant"] }, { $eq: ["$sexe", "Femme"] }] }, 1, 0] }
            }
          }
        }
      ]);

      // Extract stats from aggregation result
      const totalStudents = userStats.find(stat => stat._id === "etudiant")?.count || 0;
      const totalTeachers = userStats.find(stat => stat._id === "enseignant")?.count || 0;
      const totalAdmins = userStats.find(stat => stat._id === "admin")?.count || 0;
      const maleStudents = userStats.find(stat => stat._id === "etudiant")?.maleCount || 0;
      const femaleStudents = userStats.find(stat => stat._id === "etudiant")?.femaleCount || 0;
      const totalGenderStudents = maleStudents + femaleStudents;

      genderData = {
        male: totalGenderStudents > 0 ? Math.round((maleStudents / totalGenderStudents) * 100) : 0,
        female: totalGenderStudents > 0 ? Math.round((femaleStudents / totalGenderStudents) * 100) : 0,
        maleCount: maleStudents,
        femaleCount: femaleStudents,
      };

      // Overall attendance rate using aggregation
      const attendanceStats = await Presence.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$statut", "présent"] }, 1, 0] } }
          }
        }
      ]);

      const totalPresences = attendanceStats[0]?.total || 0;
      const presentCount = attendanceStats[0]?.present || 0;
      const attendanceRate = totalPresences > 0 ? Math.round((presentCount / totalPresences) * 100) : 0;

      const activeCourses = await Cours.countDocuments();

      // Total enrollment (all time)
      const totalEnrollmentStats = await User.aggregate([
        {
          $match: {
            role: { $in: ["etudiant", "enseignant"] }
          }
        },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ]);

      const totalStudentsEnrolled = totalEnrollmentStats.find(stat => stat._id === "etudiant")?.count || 0;
      const totalTeachersEnrolled = totalEnrollmentStats.find(stat => stat._id === "enseignant")?.count || 0;

      // Process enrollment data as general totals
      enrollmentData = [
        {
          category: "Students",
          count: totalStudentsEnrolled,
        },
        {
          category: "Teachers",
          count: totalTeachersEnrolled,
        }
      ];

      // Simplified class performance and attendance - get basic class list for now
      // TODO: Optimize these queries further if needed
      const classes = await Classe.find({}, 'nom').limit(10); // Limit to 10 classes for performance

      // Simplified class performance - just return basic data
      classPerformanceData = classes.map((cls, index) => ({
        class: cls.nom,
        average: Math.floor(Math.random() * 20) + 80, // Mock data for performance
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      }));

      // Simplified class attendance - just return basic data
      classAttendanceData = classes.map((cls, index) => ({
        class: cls.nom,
        attendance: Math.floor(Math.random() * 20) + 75, // Mock data for performance
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      }));

      // Recent announcements (last 4)
      announcements = await Announcement.find({ estActif: true })
        .populate("auteur", "prenom nom")
        .sort({ createdAt: -1 })
        .limit(4)
        .then(announcements => announcements.map(ann => ({
          title: ann.titre,
          description: ann.contenu.length > 100 ? ann.contenu.substring(0, 100) + "..." : ann.contenu,
          date: getTimeAgo(ann.createdAt),
          type: ann.type,
          icon: getAnnouncementIcon(ann.type),
        })));

      // Recent system activity (mock data for now - could be enhanced with actual activity logs)
      recentActivity = [
        {
          action: "New teacher registered",
          user: "Dr. Sarah Johnson",
          time: "2 hours ago",
          icon: "👨‍🏫",
          color: "from-blue-500 to-cyan-400",
        },
        {
          action: "Course updated",
          user: "Mathematics 101",
          time: "5 hours ago",
          icon: "📚",
          color: "from-purple-500 to-pink-400",
        },
        {
          action: "Student enrolled",
          user: "John Smith - Physics",
          time: "1 day ago",
          icon: "👥",
          color: "from-pink-500 to-blue-500",
        },
      ];

      // Calculate changes (simplified - in real app, compare with previous period)
      stats = [
        {
          title: "Total Students",
          value: totalStudents.toLocaleString(),
          icon: "👥",
          change: "+12%", // Mock change
          color: "from-blue-500 to-cyan-400",
        },
        {
          title: "Total Teachers",
          value: totalTeachers.toString(),
          icon: "👨‍🏫",
          change: "+5%", // Mock change
          color: "from-purple-500 to-pink-400",
        },
        {
          title: "Active Courses",
          value: activeCourses.toString(),
          icon: "📚",
          change: "+8%", // Mock change
          color: "from-pink-500 to-blue-500",
        },
        {
          title: "Attendance Rate",
          value: `${attendanceRate}%`,
          icon: "📈",
          change: "+3%", // Mock change
          color: "from-cyan-400 to-purple-500",
        },
      ];
    }

    const responseData = {
      stats,
      enrollmentData,
      genderData,
      classPerformanceData,
      classAttendanceData,
      announcements,
      recentActivity,
      ...((isTeacher || isStudent) && { todaysSessions }),
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, responseData);

    res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ Erreur getDashboardStats:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// Helper function to get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) return "Less than an hour ago";
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return "1 day ago";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return new Date(date).toLocaleDateString();
}

// Helper function to get announcement icon
function getAnnouncementIcon(type) {
  const icons = {
    holiday: "🎄",
    meeting: "👥",
    course: "🚀",
    exam: "📝",
    info: "ℹ️",
    warning: "⚠️",
    success: "✅",
  };
  return icons[type] || "📢";
}

// Helper function to get notification icon
function getNotificationIcon(type) {
  const icons = {
    alerte: "🚨",
    systeme: "⚙️",
    rappel: "⏰",
    avertissement: "⚠️",
    demande: "📋",
    note: "📝",
    annonce: "📢",
    material: "📚",
    emploiDuTemps: "📅",
    submission: "📩",
  };
  return icons[type] || "🔔";
}

// Helper function to get notification color
function getNotificationColor(type) {
  const colors = {
    alerte: "from-red-500 to-red-400",
    systeme: "from-blue-500 to-cyan-400",
    rappel: "from-yellow-500 to-orange-400",
    avertissement: "from-orange-500 to-red-400",
    demande: "from-purple-500 to-pink-400",
    note: "from-green-500 to-emerald-400",
    annonce: "from-indigo-500 to-purple-400",
    material: "from-teal-500 to-cyan-400",
    emploiDuTemps: "from-pink-500 to-rose-400",
    submission: "from-green-500 to-emerald-400",
  };
  return colors[type] || "from-gray-500 to-gray-400";
}
