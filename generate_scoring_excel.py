import xlsxwriter

def create_excel():
    workbook = xlsxwriter.Workbook('Talent_Vault_Scoring_Logic.xlsx')
    
    # ---------------------------------------------------------
    # FORMATS
    # ---------------------------------------------------------
    title_format = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#4F46E5', 'font_color': 'white', 'align': 'center', 'valign': 'vcenter'})
    header_format = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1, 'align': 'center'})
    bold_border = workbook.add_format({'bold': True, 'border': 1})
    border = workbook.add_format({'border': 1})
    percent_fmt = workbook.add_format({'border': 1, 'num_format': '0.00%'})
    float_fmt = workbook.add_format({'border': 1, 'num_format': '0.0'})
    highlight_fmt = workbook.add_format({'bold': True, 'bg_color': '#E2EFDA', 'border': 1})
    formula_fmt = workbook.add_format({'bold': True, 'font_color': '#C00000', 'border': 1})

    ws = workbook.add_worksheet('Scoring Logic')
    ws.set_column('A:A', 25)
    ws.set_column('B:E', 20)
    ws.set_column('F:F', 25)
    
    # Title
    ws.merge_range('A1:F1', 'Phygitron360 Talent Vault - Candidate Role-Fit Scoring Logic', title_format)

    # 1. Base Weights
    ws.write('A3', '1. Skill Level Weights', bold_border)
    ws.write_row('A4', ['Proficiency Level', 'Weight (Points)'], header_format)
    ws.write_row('A5', ['Beginner', 1], border)
    ws.write_row('A6', ['Intermediate', 2], border)
    ws.write_row('A7', ['Advanced', 3], border)
    ws.write_row('A8', ['Expert', 4], border)

    # 2. Similarity Matching
    ws.write('D3', '2. Text Similarity (Fuzzy Matching)', bold_border)
    ws.write_row('D4', ['Match Type', 'Multiplier'], header_format)
    ws.write_row('D5', ['Exact Match (e.g. "Python" == "Python")', 1.00], border)
    ws.write_row('D6', ['Close Match (e.g. "ReactJS" == "React.js")', 0.95], border)
    ws.write_row('D7', ['Token Sub-match (e.g. "React" == "React Native")', 0.90], border)
    ws.write_row('D8', ['No Match', 0.00], border)

    # 3. Example Scenario
    ws.write('A11', '3. Example Scenario Calculation', bold_border)
    
    # Required Skills
    ws.write('A12', 'Job Requirements', header_format)
    ws.write_row('A13', ['Required Skill', 'Required Level', 'Weight (Max Pts)'], header_format)
    ws.write_row('A14', ['Python', 'Expert', 4], border)
    ws.write_row('A15', ['React', 'Advanced', 3], border)
    ws.write_row('A16', ['AWS', 'Intermediate', 2], border)
    ws.write('B17', 'Total Required Weight:', bold_border)
    ws.write('C17', 9, highlight_fmt) # 4 + 3 + 2

    # Candidate Skills
    ws.write('A19', 'Candidate Profile', header_format)
    ws.write_row('A20', ['Candidate Skill', 'Candidate Level', 'Level Weight', 'Similarity', 'Level Penalty Ratio (sqrt(cand/req))', 'Earned Points'], header_format)
    
    # Python (Candidate is Advanced = 3, Req is Expert = 4)
    ws.write_row('A21', ['Python', 'Advanced', 3, 1.0, '=MIN((3/4)^0.5, 1)'], border)
    ws.write('F21', '=C14*D21*E21', float_fmt) # 4 * 1.0 * sqrt(0.75) = 3.46

    # React (Candidate is Expert = 4, Req is Advanced = 3)
    ws.write_row('A22', ['React.js', 'Expert', 4, 0.95, '=MIN((4/3)^0.5, 1)'], border)
    ws.write('F22', '=C15*D22*E22', float_fmt) # 3 * 0.95 * 1 = 2.85

    # AWS (Candidate doesn't have it)
    ws.write_row('A23', ['- (Missing)', '-', 0, 0.0, 0.0], border)
    ws.write('F23', 0.0, float_fmt)
    
    ws.write('E24', 'Total Earned Points:', bold_border)
    ws.write('F24', '=SUM(F21:F23)', highlight_fmt)

    # Final Score Calculation
    ws.write('A26', '4. Final Curve & Score', bold_border)
    
    ws.write('A27', 'Raw Mathematical Match:', border)
    ws.write('B27', '=F24/C17', percent_fmt)
    ws.write('C27', '(Earned Points / Total Required Points)', border)

    ws.write('A28', 'Curve Boost Formula:', border)
    ws.write('B28', '=(Raw^0.5)*100%', formula_fmt)
    ws.write('C28', 'Algorithmic boost to ensure realistic grading (e.g. 64% raw = 80% final)', border)

    ws.write('A29', 'Boosted ATS Score:', bold_border)
    ws.write('B29', '=(B27^0.5)', percent_fmt)

    ws.write('A30', 'Experience Penalty:', border)
    ws.write('B30', '-10.0%', formula_fmt)
    ws.write('C30', 'If candidate has less exp than required (soft penalty)', border)

    ws.write('A31', 'FINAL ROLE-FIT SCORE:', highlight_fmt)
    ws.write('B31', '=B29-0.10', percent_fmt)

    workbook.close()

if __name__ == "__main__":
    create_excel()
