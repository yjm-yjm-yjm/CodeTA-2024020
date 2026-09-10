package model

import "testing"

func TestScore(t *testing.T) {
	cases := []struct {
		name string
		r    Review
		want float64
	}{
		{"满分", Review{Innovation: 10, Technology: 10, Value: 10}, 10.0},
		{"全零", Review{Innovation: 0, Technology: 0, Value: 0}, 0.0},
		{"典型", Review{Innovation: 8, Technology: 6, Value: 7}, 7.1},
		{"偏科", Review{Innovation: 10, Technology: 5, Value: 5}, 7.0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.r.Score(); got != c.want {
				t.Fatalf("Score() = %v, 期望 %v", got, c.want)
			}
		})
	}
}
