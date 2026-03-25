#!/usr/bin/env sh

# create data folders
mkdir -p data/atenolol
mkdir -p data/metformin_glp
mkdir -p data/forest_plot

cp atenolol_gender/Atenolol\ Female\ No\ B.csv data/atenolol/b_atenolol_female_no.csv
cp atenolol_gender/Atenolol\ Female\ Yes\ A.csv data/atenolol/a_atenololfemale_yes.csv
cp atenolol_gender/Atenolol\ Male\ No\ D.csv data/atenolol/d_atenolol_male_no.csv
cp atenolol_gender/Atenolol\ Male\ Yes\ C.csv data/atenolol/c_atenolol_male_yes.csv

cp metformin_glp/glp-b.csv data/metformin_glp/b_glp.csv
cp metformin_glp/glp-prog-d.csv data/metformin_glp/d_glp_prog.csv
cp metformin_glp/metformin-a.csv data/metformin_glp/a_metformin.csv
cp metformin_glp/metformin-prog-c.csv data/metformin_glp/c_metformin_prog.csv

cp forest_plot/EliCri+GLP1\ total.csv data/forest_plot/d_group_b_elicri_glp1_total.csv
cp forest_plot/EliCri+GLP1\ UTI.csv data/forest_plot/c_group_b_elicri_glp1_uti.csv
cp forest_plot/EliCri+SGLT2\ total.csv data/forest_plot/b_group_a_elicri_sglt2_total.csv
cp forest_plot/EliCri+SGLT2\ UTI.csv data/forest_plot/a_group_a_elicri_sglt2_uti.csv

exit 0
