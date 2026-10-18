package main

// Working candidates supplied by players from MabiPrograms skill_ids.cs and
// gameplay reports. This registry does not imply observed healing or shields.
func isHealingCandidateSkill(id uint16) bool {
	switch id {
	case 30006, 30008, 59000, 59001, 59002, 59003, 59004, 59006,
		27200, 27201, 27204, 27205, 27206, 35121:
		return true
	}
	return false
}
