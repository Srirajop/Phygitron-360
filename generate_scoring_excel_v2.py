import xlsxwriter

def create_excel():
    workbook = xlsxwriter.Workbook('Talent_Vault_Scoring_Presentation.xlsx')
    
    # FORMATS
    title_fmt = workbook.add_format({'bold': True, 'font_size': 16, 'bg_color': '#4F46E5', 'font_color': 'white', 'align': 'center', 'valign': 'vcenter'})
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1, 'align': 'center'})
    bold_fmt = workbook.add_format({'bold': True})
    border_fmt = workbook.add_format({'border': 1, 'align': 'center'})
    percent_fmt = workbook.add_format({'border': 1, 'align': 'center', 'num_format': '0%'})
    final_score_fmt = workbook.add_format({'bold': True, 'bg_color': '#C6E0B4', 'border': 1, 'align': 'center', 'num_format': '0%'})
    
    ws = workbook.add_worksheet('Candidate Comparison')
    ws.set_column('A:A', 25)
    ws.set_column('B:M', 15)
    
    # Title
    ws.merge_range('A1:J1', 'Talent Central - How We Score Candidates', title_fmt)

    # ---------------------------------------------------------
    # PART 1: THE JOB REQUIREMENTS (THE BENCHMARK)
    # ---------------------------------------------------------
    ws.write('A3', '1. JOB REQUIREMENTS (The Benchmark)', bold_fmt)
    
    ws.write_row('B4', ['Skill Name', 'Required Level', 'Weight (Points)'], header_fmt)
    ws.write_row('B5', ['Python', 'Expert', 4], border_fmt)
    ws.write_row('B6', ['React', 'Advanced', 3], border_fmt)
    ws.write_row('B7', ['AWS', 'Intermediate', 2], border_fmt)
    ws.write('C8', 'Total Max Points:', bold_fmt)
    ws.write('D8', 9, bold_fmt) # Total = 9
    
    # ---------------------------------------------------------
    # PART 2: COMPARING CANDIDATES
    # ---------------------------------------------------------
    ws.write('A11', '2. CANDIDATE COMPARISON', bold_fmt)

    # CANDIDATE 1 (The Perfect Match)
    ws.write('A13', 'CANDIDATE 1: Alex (Perfect Match)', bold_fmt)
    ws.write_row('B13', ['Candidate Level', 'Points Earned', 'Match %'], header_fmt)
    ws.write('A14', 'Python')
    ws.write_row('B14', ['Expert', 4, 1.0], border_fmt)
    ws.write('C14', 4, border_fmt)
    ws.write('D14', '=C14/4', percent_fmt)

    ws.write('A15', 'React')
    ws.write_row('B15', ['Advanced', 3, 1.0], border_fmt)
    ws.write('C15', 3, border_fmt)
    ws.write('D15', '=C15/3', percent_fmt)

    ws.write('A16', 'AWS')
    ws.write_row('B16', ['Intermediate', 2, 1.0], border_fmt)
    ws.write('C16', 2, border_fmt)
    ws.write('D16', '=C16/2', percent_fmt)

    ws.write('A17', 'Raw Mathematical Score:', bold_fmt)
    ws.write('C17', '=SUM(C14:C16)', border_fmt)
    ws.write('D17', '=C17/9', percent_fmt)

    ws.write('A18', 'Final Display Score (Curved):', bold_fmt)
    ws.write('C18', '=(D17^0.5)', percent_fmt)
    ws.write('D18', '=C18', final_score_fmt)

    # CANDIDATE 2 (The Partial Match)
    ws.write('A21', 'CANDIDATE 2: Sarah (Partial Match)', bold_fmt)
    ws.write_row('B21', ['Candidate Level', 'Points Earned', 'Match %'], header_fmt)
    ws.write('A22', 'Python (Req: Expert)')
    # Sarah is Advanced (3), Req is Expert (4) -> points = 4 * sqrt(3/4) = 3.46
    ws.write_row('B22', ['Advanced', 3.46, '=3.46/4'], border_fmt)
    ws.write('D22', '=C22/4', percent_fmt)

    ws.write('A23', 'React (Req: Advanced)')
    # Sarah is Intermediate (2), Req is Advanced (3) -> points = 3 * sqrt(2/3) = 2.45
    ws.write_row('B23', ['Intermediate', 2.45, '=2.45/3'], border_fmt)
    ws.write('D23', '=C23/3', percent_fmt)

    ws.write('A24', 'AWS (Req: Intermediate)')
    ws.write_row('B24', ['Missing', 0, 0], border_fmt)
    ws.write('D24', '=C24/2', percent_fmt)

    ws.write('A25', 'Raw Mathematical Score:', bold_fmt)
    ws.write('C25', '=SUM(C22:C24)', border_fmt)
    ws.write('D25', '=C25/9', percent_fmt)

    ws.write('A26', 'Final Display Score (Curved):', bold_fmt)
    ws.write('C26', '=(D25^0.5)', percent_fmt)
    ws.write('D26', '=C26', final_score_fmt)

    # ---------------------------------------------------------
    # PART 3: THE PENALTIES
    # ---------------------------------------------------------
    ws.write('A29', '3. HOW PENALTIES WORK', bold_fmt)
    ws.write('A30', 'Rule 1: Lower Skill Level')
    ws.write('B30', 'If a candidate has "Intermediate" but the job needs "Expert", they get partial credit (not a zero).')
    
    ws.write('A31', 'Rule 2: Experience Gap')
    ws.write('B31', 'If a job needs 5 years, and they have 2 years, we deduct up to 15% from their final score.')

    ws.write('A32', 'Rule 3: Algorithmic Curve')
    ws.write('B32', 'Raw scores are boosted (e.g. a 65% raw math score becomes an 80% fit score) to be more human-readable.')

    workbook.close()

if __name__ == "__main__":
    create_excel()
