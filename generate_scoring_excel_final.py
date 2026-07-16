import xlsxwriter

def create_excel():
    workbook = xlsxwriter.Workbook('Talent_Vault_Scoring_Master_V2.xlsx')
    
    # FORMATS
    title_fmt = workbook.add_format({'bold': True, 'font_size': 18, 'bg_color': '#1E1B4B', 'font_color': 'white', 'align': 'center', 'valign': 'vcenter'})
    step_fmt = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#4F46E5', 'font_color': 'white'})
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#E0E7FF', 'border': 1, 'align': 'center'})
    bold_border = workbook.add_format({'bold': True, 'border': 1})
    border = workbook.add_format({'border': 1})
    border_center = workbook.add_format({'border': 1, 'align': 'center'})
    percent_fmt = workbook.add_format({'border': 1, 'align': 'center', 'num_format': '0%'})
    final_score_fmt = workbook.add_format({'bold': True, 'bg_color': '#22C55E', 'font_color': 'white', 'border': 1, 'align': 'center', 'num_format': '0%'})
    text_wrap = workbook.add_format({'text_wrap': True, 'valign': 'top'})
    
    ws = workbook.add_worksheet('Scoring Masterclass')
    ws.set_column('A:A', 35)
    ws.set_column('B:E', 20)
    
    # Title
    ws.merge_range('A1:E2', 'Talent Vault: AI Scoring & Ranking Breakdown', title_fmt)

    # ---------------------------------------------------------
    # STEP 1: AI EXTRACTION
    # ---------------------------------------------------------
    ws.write('A4', 'STEP 1: How We Get The Data', step_fmt)
    ws.write('A5', 'For Job Roles:', bold_border)
    ws.merge_range('B5:E5', 'HR pastes a Job Description. AI reads it and extracts required skills and the required proficiency (e.g. "5+ years Python" = Expert).', text_wrap)
    
    ws.write('A6', 'For Candidates:', bold_border)
    ws.merge_range('B6:E6', 'HR bulk uploads resumes (from drives, LinkedIn). AI parses each resume\'s context to classify the candidate\'s skills into 4 levels.', text_wrap)

    # ---------------------------------------------------------
    # STEP 2: THE WEIGHTS
    # ---------------------------------------------------------
    ws.write('A8', 'STEP 2: The Point System', step_fmt)
    ws.write_row('A9', ['Proficiency Level', 'Points Awarded'], header_fmt)
    ws.write_row('A10', ['Beginner', 1], border_center)
    ws.write_row('A11', ['Intermediate', 2], border_center)
    ws.write_row('A12', ['Advanced', 3], border_center)
    ws.write_row('A13', ['Expert', 4], border_center)

    # ---------------------------------------------------------
    # STEP 3: CANDIDATE COMPARISON
    # ---------------------------------------------------------
    ws.write('A15', 'STEP 3: The Match Calculation (Example)', step_fmt)
    
    # JOB REQS
    ws.write('A16', 'The Benchmark (Job Requirements)', header_fmt)
    ws.write_row('B16', ['Req Level', 'Max Points'], header_fmt)
    ws.write('A17', 'Python', border)
    ws.write_row('B17', ['Expert', 4], border_center)
    ws.write('A18', 'React', border)
    ws.write_row('B18', ['Advanced', 3], border_center)
    
    ws.write('A19', 'TOTAL POINTS POSSIBLE', bold_border)
    ws.write('C19', 7, bold_border)

    # CANDIDATE 1
    ws.write('A21', 'Candidate 1: Alex (Perfect Match)', header_fmt)
    ws.write_row('B21', ['Actual Level', 'Points Earned'], header_fmt)
    ws.write('A22', 'Python')
    ws.write_row('B22', ['Expert', 4], border_center)
    ws.write('A23', 'React')
    ws.write_row('B23', ['Advanced', 3], border_center)
    ws.write('A24', 'Total Earned', bold_border)
    ws.write('C24', 7, bold_border)

    # CANDIDATE 2
    ws.write('A26', 'Candidate 2: Sarah (Partial Match)', header_fmt)
    ws.write_row('B26', ['Actual Level', 'Points Earned'], header_fmt)
    ws.write('A27', 'Python')
    ws.write_row('B27', ['Advanced', 3.46], border_center)
    ws.write('A28', 'React')
    ws.write_row('B28', ['Intermediate', 2.45], border_center)
    ws.write('A29', 'Total Earned', bold_border)
    ws.write('C29', 5.91, bold_border)

    # ---------------------------------------------------------
    # STEP 4: THE CURVE
    # ---------------------------------------------------------
    ws.write('A31', 'STEP 4: The Grading Curve', step_fmt)
    ws.merge_range('A32:E32', 'Formula: Square Root of (Earned / Possible). This boosts middle scores so strong candidates are easily visible to recruiters.', text_wrap)
    ws.set_row(31, 30)

    ws.write_row('A34', ['Candidate', 'Raw Math Score', 'Final Display Score (Curved)'], header_fmt)
    
    ws.write('A35', 'Alex', border_center)
    ws.write('B35', '=C24/C19', percent_fmt)
    ws.write('C35', '=(B35^0.5)', final_score_fmt)

    ws.write('A36', 'Sarah', border_center)
    ws.write('B36', '=C29/C19', percent_fmt)
    ws.write('C36', '=(B36^0.5)', final_score_fmt)

    workbook.close()

if __name__ == "__main__":
    create_excel()
