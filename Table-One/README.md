https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6773463/#:~:text=Example%20construction%20of%20Table%201,1%2C2

- Reference the wireframe powerpoint for UI layout guidance.
- Allow the user to type in labels where specified in the wireframe. 
- When user drops breakdown queries the labels are extracted from the first column of the breakdown csv.
- Allow the user to drop SHRINE query csv files where specified in the wireframe.
- Allow the user to specify what to substitute for 10 or fewer
- Determine which sites have answers (a site is included if the cell has a number or "10 or fewer") in all four csv files.
- Total results for each csv only including sites that have answers in all csv files
- Put the total for the csv in the appropriate place in the table.
- At the bottom of the output list sites that are included in the aggregate numbers as a footnote.
- In the breakdown csv there is a value for total patients. use that for the denominator.
- If not including the demographic breakdown the user must drop the cohort csv. In that case the value in that csv is the denominator.
