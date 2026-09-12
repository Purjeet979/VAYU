import unittest

from app.source_intelligence import (
    angular_difference_deg,
    bearing_to_deg,
    dbscan_haversine,
    haversine_km,
    wind_alignment_score,
)


class SourceIntelligenceMathTests(unittest.TestCase):
    def test_distance_and_bearing(self):
        self.assertAlmostEqual(haversine_km(28.6139, 77.2090, 28.6139, 77.2090), 0.0)
        self.assertGreater(haversine_km(28.6139, 77.2090, 29.0, 76.7), 50)
        self.assertAlmostEqual(bearing_to_deg(0, 0, 1, 0), 0.0, places=4)

    def test_directional_alignment(self):
        self.assertEqual(angular_difference_deg(350, 10), 20)
        self.assertAlmostEqual(wind_alignment_score(120, 120), 1.0)
        self.assertAlmostEqual(wind_alignment_score(120, 300), 0.0)

    def test_dbscan_groups_nearby_points_and_marks_outlier(self):
        points = [(28.60, 77.20), (28.61, 77.21), (28.62, 77.20), (29.20, 76.50)]
        labels = dbscan_haversine(points, epsilon_km=3, min_samples=3)
        self.assertEqual(labels[:3], [0, 0, 0])
        self.assertEqual(labels[3], -1)


if __name__ == "__main__":
    unittest.main()
