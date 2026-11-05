// Verify this claim by writing a program Ramanujan.java that takes an integer command-line
//  argument n and prints all integers less than or equal to n that can be expressed as
//  the sum of two cubes in two different ways - find distinct positive integers a, b, c, and d
//   such that a3 + b3 = c3 + d3. Use four nested for loops.

public class Ramanujan {
    public static void main(String[] args) {
        int n = Integer.parseInt(args[0]);

        int intMax = (int) Math.cbrt(n);
        for(int a = 1; a <= intMax; a++) {
            for(int b = a+1; b <= intMax; b++) {
                for(int c = b+1; c <= intMax; c++) {
                    for(int d = 1; d < b; d++) {
                        if((a*a*a) + (b*b*b) == (c*c*c + d*d*d)) {
                            System.out.print(
                                ((a*a*a)+(b*b*b)) + ", a=" + a + ", b=" +
                                b + ", c=" + c + ", d=" + d + "\n\n"
                            );
                        }
                    }
                }
            }
        }
    }
}